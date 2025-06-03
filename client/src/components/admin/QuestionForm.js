import React, { useState, useEffect } from 'react';

const QuestionForm = ({ questionToEdit, onFormSubmit }) => {
  const [text, setText] = useState('');
  const [type, setType] = useState('single_answer'); // 'single_answer' or 'multiple_choice'
  const [options, setOptions] = useState(['', '', '', '']); // For multiple_choice
  const [correctAnswer, setCorrectAnswer] = useState('');

  useEffect(() => {
    if (questionToEdit) {
      setText(questionToEdit.text || '');
      setType(questionToEdit.type || 'single_answer');
      setCorrectAnswer(questionToEdit.correct_answer || '');
      if (questionToEdit.type === 'multiple_choice' && questionToEdit.options) {
        // Ensure options has at least 4 elements for the form
        const currentOptions = Array.isArray(questionToEdit.options) ? questionToEdit.options : [];
        const newOptions = [...currentOptions];
        while(newOptions.length < 4) newOptions.push('');
        setOptions(newOptions.slice(0,4)); // take first 4
      } else {
        setOptions(['', '', '', '']);
      }
    } else {
      // Reset form for new question
      setText('');
      setType('single_answer');
      setOptions(['', '', '', '']);
      setCorrectAnswer('');
    }
  }, [questionToEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const questionData = {
        text,
        type,
        correct_answer: correctAnswer
    };
    if (type === 'multiple_choice') {
      // Filter out empty options before submitting
      questionData.options = options.filter(opt => opt.trim() !== '');
      if (questionData.options.length < 2) {
        alert("Multiple choice questions must have at least 2 non-empty options.");
        return;
      }
    }
    onFormSubmit(questionData);
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>{questionToEdit ? 'Edit Question' : 'Create New Question'}</h3>
      <div>
        <label>Question Text:</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} required />
      </div>
      <div>
        <label>Question Type:</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="single_answer">Single Answer (Textbox)</option>
          <option value="multiple_choice">Multiple Choice</option>
        </select>
      </div>
      {type === 'multiple_choice' && (
        <div>
          <label>Options:</label>
          {options.map((option, index) => (
            <div key={index}>
              <input
                type="text"
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
              />
            </div>
          ))}
          <p><small>Define at least two options. Correct answer for MCQs should exactly match one of the options text.</small></p>
        </div>
      )}
      <div>
        <label>Correct Answer:</label>
        <input type="text" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} required />
      </div>
      <button type="submit">{questionToEdit ? 'Update Question' : 'Add Question'}</button>
    </form>
  );
};

export default QuestionForm;
