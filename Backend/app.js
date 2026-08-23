require("dotenv").config({
    path: require("path").join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors"); //to allow cross orogin resouse sharing between the two different ports 
const multer = require("multer"); //to parse/unpack/  save the raw audio data because express can'tdo that express only parses text data
const { google } = require("googleapis"); //calling google from api package
const { Readable } = require("node:stream"); //
const { randomUUID } = require("node:crypto");
const path = require("node:path");

const app = express();  //creating express app instance

const upload = multer({
    storage: multer.memoryStorage()
});


app.use(cors());

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    },
    projectId: process.env.GOOGLE_PROJECT_ID,
    scopes: ["https://www.googleapis.com/auth/drive"]
});

const drive = google.drive({
    version: "v3",
    auth
});

app.post("/api/audio", upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "No audio file uploaded"
            });
        }

        // append a timestamp + uuid so repeated uploads never share a name
        const ext = path.extname(req.file.originalname) || ".mp3";
        const base = path.basename(req.file.originalname, ext);
        const uniqueName = `${base}-${Date.now()}-${randomUUID()}${ext}`;

        const driveResponse = await drive.files.create({
            requestBody: {
                name: uniqueName,
                mimeType: req.file.mimetype,
                parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
            },
            media: {
                mimeType: req.file.mimetype,
                body: Readable.from(req.file.buffer)
            },
            fields: "id,name,mimeType,parents,webViewLink",
            // required so the service account can create files in a Shared Drive
            supportsAllDrives: true
        });

        res.status(201).json({
            message: "Audio uploaded to Google Drive successfully",
            file: driveResponse.data
        });
    } catch (error) {
        console.error("Google Drive upload failed:", error);

        res.status(500).json({
            error: error.message
        });
    }
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
//initializing blender
    //listen to users request to get stl
const stl_req = document.getElementById("save-stl");


    //upon request route to receive the saved mp3 blob 
    app.post("/api/audio", upload.single("audio"), //multer expects one fike field named audio
        async(req, res) => { 
        if(!req.file){
            return res.status(400).json({error: "No file found"})
        }
        //uploading file metadata and buffer
        console.log(req.file.originalname);
        console.log(req.file.mimetype);
        console.log(req.file.buffer);
    });
    //get audio from saved trimmed audio

   //send audio to blender 

//blender job handling

     //for every job 
     //get job id, start time, end time and status 
     //store job meta data in postgresql 
     //send  status updates to front end

