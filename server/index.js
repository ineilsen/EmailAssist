const express = require('express');
const path = require('path');
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const examRoutes = require('./routes/exams');
const studentRoutes = require('./routes/student'); // Import student routes

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// API routes
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the Online Exam Platform API!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/student', studentRoutes); // Use student routes

// Basic error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // db object is now available and schema initialization is triggered from database.js
});
