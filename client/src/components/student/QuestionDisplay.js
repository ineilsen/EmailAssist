import React, { useState, useEffect } from 'react';

const QuestionDisplay = ({ question, onAnswerSubmit, questionNumber, totalQuestions }) => {
  const [selectedAnswer, setSelectedAnswer] = useState(''); // For MCQs, this might be the option value/text
                                                          // For single_answer, this is the text input

  useEffect(() => {
    // Reset selected answer when question changes
    setSelectedAnswer('');
  }, [question]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedAnswer === '' && question.type === 'multiple_choice') {
        alert('Please select an option.');
        return;
    }
    if (selectedAnswer.trim() === '' && question.type === 'single_answer') {
        alert('Please enter your answer.');
        return;
    }
    onAnswerSubmit(question.id, selectedAnswer);
    // setSelectedAnswer(''); // Optionally clear after submit, or parent handles currentQ index change
  };

  if (!question) return <p>Loading question...</p>;

  return (
    <div style={{ border: '1px solid #ddd', padding: '15px', margin: '10px 0' }}>
      <h4>Question {questionNumber} of {totalQuestions}</h4>
      <p style={{fontWeight:'bold'}}>{question.text}</p>

      <form onSubmit={handleSubmit}>
        {question.type === 'multiple_choice' && question.options && (
          <div style={{display: 'flex', flexDirection:'column'}}>
            {question.options.map((option, index) => (
              <label key={index} style={{ margin: '5px', padding: '8px', border: '1px solid #eee', borderRadius: '4px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`question_${question.id}`}
                  value={typeof option === 'object' ? option.value : option} // Assuming options could be {text, value} or just strings
                  checked={selectedAnswer === (typeof option === 'object' ? option.value : option)}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  style={{marginRight: '10px'}}
                />
                {typeof option === 'object' ? option.text : option}
              </label>
            ))}
          </div>
        )}

        {question.type === 'single_answer' && (
          <div>
            <textarea
              value={selectedAnswer}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              placeholder="Your answer here..."
              rows="3"
              style={{width: '90%', padding:'8px', marginTop:'10px', border:'1px solid #ccc', borderRadius:'4px'}}
            />
          </div>
        )}
        <button type="submit" style={{marginTop:'15px', padding: '10px 15px', backgroundColor:'#007bff', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>Submit Answer</button>
      </form>
    </div>
  );
};

export default QuestionDisplay;
