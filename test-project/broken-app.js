// Broken JavaScript with multiple issues
const express = require('express');
const app = express();

// Missing semicolon
const port = 3000

// Unused variable
const unusedVar = "test";

// Function with syntax error
function brokenFunction() {
    console.log("Hello World"
    // Missing closing parenthesis
}

// Inconsistent button handler
app.get('/button', (req, res) => {
    res.send('<button onclick="doesntExist()">Broken Button</button>');
});

// Route that doesn't work
app.get('/broken-route', (req, res) => {
    res.status(500).json({ error: nonExistentVariable });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});