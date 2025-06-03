-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student', 'admin')) -- 'student' or 'admin'
);

-- Questions table
CREATE TABLE questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('multiple_choice', 'single_answer')), -- 'multiple_choice' or 'single_answer'
    options TEXT, -- JSON string for multiple_choice, NULL for single_answer
    correct_answer TEXT NOT NULL
);

-- Exams table
CREATE TABLE exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    time_per_question INTEGER NOT NULL, -- in seconds
    question_limit INTEGER NOT NULL CHECK(question_limit > 0 AND question_limit <= 25)
);

-- Exam_Questions table (to link questions to exams and define order)
CREATE TABLE exam_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    question_order INTEGER NOT NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE (exam_id, question_id),
    UNIQUE (exam_id, question_order)
);

-- Student_Exams table (to track student progress on exams)
CREATE TABLE student_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    score INTEGER,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

-- Student_Answers table (to store answers given by students)
CREATE TABLE student_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_exam_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_text TEXT,
    is_correct BOOLEAN,
    FOREIGN KEY (student_exam_id) REFERENCES student_exams(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) -- No CASCADE here, as we might want to keep answers even if a question is deleted for archival.
);

-- Indexes for performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_exam_questions_exam_id ON exam_questions(exam_id);
CREATE INDEX idx_exam_questions_question_id ON exam_questions(question_id);
CREATE INDEX idx_student_exams_student_id ON student_exams(student_id);
CREATE INDEX idx_student_exams_exam_id ON student_exams(exam_id);
CREATE INDEX idx_student_answers_student_exam_id ON student_answers(student_exam_id);
CREATE INDEX idx_student_answers_question_id ON student_answers(question_id);
