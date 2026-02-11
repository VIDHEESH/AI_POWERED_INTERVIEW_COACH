require('dotenv').config();
const express = require('express');
const { initDb } = require('./db');

const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
console.log('Serving static files from:', path.join(__dirname, 'public'));

// Routes
const authRoutes = require('./authentication/route/auth');
const interviewRoutes = require('./interview/route/interview');

app.use('/auth', authRoutes);
app.use('/interview', interviewRoutes);

// Serve uploads directory
// Serve uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log('Created uploads directory');
}
app.use('/uploads', express.static(uploadsDir));



// Initialize DB and start server
initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});
