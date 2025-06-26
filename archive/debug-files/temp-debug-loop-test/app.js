// Test application with intentional issues for debugging
const express = require('express');
const app = express();

// Issue 1: Missing middleware
app.get('/', (req, res) => {
    res.send('Hello World');
});

// Issue 2: Undefined variable
app.get('/error', (req, res) => {
    console.log(undefinedVariable); // This will cause an error
    res.send('Error route');
});

// Issue 3: Missing error handling
app.get('/data', (req, res) => {
    const data = JSON.parse('invalid json'); // Will throw error
    res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});