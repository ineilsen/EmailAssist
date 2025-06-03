const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Path to the SQLite database file
const DB_PATH = path.join(__dirname, '..', 'database', 'exam_platform.db');
// Path to the schema file
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'database', 'schema.sql');

// Initialize the database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeSchema();
  }
});

function initializeSchema() {
  fs.readFile(SCHEMA_PATH, 'utf8', (err, schemaSql) => {
    if (err) {
      console.error('Error reading schema file:', err);
      return;
    }
    db.exec(schemaSql, (err) => {
      if (err) {
        console.error('Error executing schema:', err.message);
      } else {
        console.log('Database schema initialized successfully.');
      }
    });
  });
}

module.exports = db;
