import React from 'react';
import './App.css';
import QuestionList from './components/admin/QuestionList';
import ExamList from './components/admin/ExamList';
import StudentExamView from './components/student/StudentExamView'; // Import StudentExamView

function App() {
  // This App.js is becoming a monolith for dev; routing would separate these views.
  return (
    <div className="App">
      <header className="App-header">
        <h1>Online Exam Platform</h1>
      </header>
      <main>
        {/* Admin Section - For dev, toggle visibility or use routing later */}
        <div style={{border:'2px solid blue', padding:'10px', marginBottom:'20px'}}>
          <h2 style={{textAlign:'center', marginTop:0}}>Admin Dashboard</h2>
          <QuestionList />
          <hr style={{margin: '20px 0'}} />
          <ExamList />
        </div>

        {/* Student Section */}
        <div style={{border:'2px solid green', padding:'10px'}}>
          <h2 style={{textAlign:'center', marginTop:0}}>Student Exam Area</h2>
          <StudentExamView />
        </div>
      </main>
    </div>
  );
}

export default App;
