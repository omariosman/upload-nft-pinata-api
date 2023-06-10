const multer = require("multer");
const express = require("express");
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

const upload = multer({ dest: "uploads/" });

require('dotenv').config();

const PINATA_API = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const JWT = process.env.JWT;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/upload_files", upload.array("files"), async (req, res) => {

    // Create /tmp/uri directory if it doesn't exist
    let directoryPath = './uri';
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }
    
    let jsonURIList = [];
    let counter = 1;
    //loop over each image and upload it to pinata 
    //create a json object that includes the image hash 
    //and push the json object to a list
    for (let file of req.files) {
        let formData = new FormData();
        let tempFilePath = file.path;
        let readStream = fs.createReadStream(tempFilePath);
        formData.append("file", readStream);

        formData.append("pinataOptions", JSON.stringify({
            wrapWithDirectory: false,
        }));

        let response;
        try {
            response = await axios.post(PINATA_API, formData, {
                headers: {
                    ...formData.getHeaders(),
                    "Authorization": `Bearer ${JWT}`,
                },
            });
        } catch (error) { 
            res.status(500).send('An error occurred while uploading to Pinata.');
            return;
            }

            let pinataResponse = response.data;

            // Create JSON object with image hash
            let jsonObject = {
                "name": `uri${counter}.json`,
                "image": `https://gateway.pinata.cloud/ipfs/${pinataResponse.IpfsHash}`
            };
            counter = counter + 1;
            jsonURIList.push(jsonObject);
           
            // Write the JSON object to a file in ./uri directory
            readStream.close();            
    }

    //write json objects to json files
    counter = 1;
    for(let jsonObj of jsonURIList) {
        let content = JSON.stringify(jsonObj);

        fs.writeFile(`./uri/${counter}.json`, content, 'utf8', function (err) {
            if (err) {
                return console.log(err);
            }
        }); 
        counter = counter + 1;
    }

    //read json files and upload them to pinata
    let formData2 = new FormData();
    fs.readdir(directoryPath, (err, files) => {
        if (err) {
          console.error('Error reading directory:', err);
          return;
        }
      
        files.forEach((file) => {
          const filePath = path.join(directoryPath, file);
          
          let readStream2 = fs.createReadStream(filePath);
          formData2.append("file", readStream2);

        });
      });

    formData2.append("pinataOptions", JSON.stringify({
        wrapWithDirectory: true,
    }));

    response = await axios.post(PINATA_API, formData2, {
        headers: {
            ...formData2.getHeaders(),
            "Authorization": `Bearer ${JWT}`,
        },
    });

    const data = response.data;
    const hash = data.IpfsHash;
    console.log("jsons hash: ", hash);
    res.status(200).send('pining images is done');
  
});

app.listen(5000, () => {
    console.log(`Server started...`);
});