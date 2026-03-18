const express = require('express');
const app = express();
const port = 3000;

// tells your API how to read incoming JSON data.
app.use(express.json());

// A basic GET route to test if the server is awake
app.get('/', (req, res) => {
  res.send('Prediction Service API is up and running!');
});

//POST route to catch incoming predictions
app.post('/api/predictions', (req, res) => {
    //req.body holds the JSON payload sent by the frontend
    const prediction = req.body;

    // Data Validation
    if (!prediction.userId || !prediction.eventId || prediction.predictedValue === undefined) {
        // if something missing, give 400 bad request error
        return res.status(400).json({
            error: "Validation failed: Missing userId, eventId, or predictedValue."
        });
    }
    // Success Scenario
    // later -- write code to save to cosmos db and service bus
    console.log("Success! Caught a new prediction", prediction);

    // send a 201 created status back to frontend so it knows it worked
    res.status(201).json({
        message: "Prediction safely received!",
        savedData: prediction
    });
});

// This tells the server to turn on and start listening
app.listen(port, () => {
  console.log(`Server is awake! Listening on http://localhost:${port}`);
});