require("dotenv").config({
    path: require("path").join(__dirname, ".env")
});
const { spawn } = require("node:child_process");
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
app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
app.post("/api/audio", upload.single("audio"), async (req, res) => { //multer expects one file field named audio
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

// generates an STL from uploaded audio via the Python script
app.post("/api/stl", upload.single("audio"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
    }

    const jobId = randomUUID();
    // audio_ring_to_stl.py reads raw WAV PCM via scipy, so keep the .wav extension
    const inputAudioPath = path.join(__dirname, "tmp", `${jobId}-input.wav`);
    const outputStlPath = path.join(__dirname, "tmp", `${jobId}-output.stl`);

    try {
        await require("node:fs/promises").mkdir(path.join(__dirname, "tmp"), { recursive: true });
        await require("node:fs/promises").writeFile(inputAudioPath, req.file.buffer);
    } catch (error) {
        console.error("Failed to save uploaded audio:", error);
        return res.status(500).json({ error: "Could not save uploaded audio" });
    }

    // use the project's virtualenv python so scipy/numpy are available
    const venvPython = path.join(__dirname, "..", ".venv", "Scripts", "python.exe");
    const pythonExecutable = require("node:fs").existsSync(venvPython) ? venvPython : "python";

    const python = spawn(pythonExecutable, [
        path.join(__dirname, "audio_ring_to_stl.py"),
        inputAudioPath,
        outputStlPath
    ]);

    let stderr = "";
    python.stderr.on("data", (chunk) => { stderr += chunk; });

    python.on("close", (code) => {
        if (code !== 0) {
            console.error("STL generation failed:", stderr);
            return res.status(500).json({ error: "STL generation failed" });
        }

        res.download(outputStlPath, "audio-ring.stl");
    });

    python.on("error", (error) => {
        console.error("Failed to start python process:", error);
        res.status(500).json({ error: "Could not start STL generation" });
    });
});


// //initializing blender
//     //listen to users request to get stl

//     //upon request route to receive the saved mp3 blob 
//     app.post("/api/audio", upload.single("audio"), //multer expects one file field named audio
//         async(req, res) => { 
//         if(!req.file){
//             return res.status(400).json({error: "No file found"})
//         }
//         //uploading file metadata and buffer to backend 
//         console.log(req.file.originalname);
//         console.log(req.file.mimetype);
//         console.log(req.file.buffer);


        
//     });

//excecuting the python scripts 

//set up trigger for excecuting python scripts 0> triger is user's keyboard input
   //send audio to blender 
//what endpoint is receiving the audio input in blender?

//blender job handling

     //for every job 
     //get job id, start time, end time and status 
     //store job meta data in postgresql 
     //send  status updates to front end

