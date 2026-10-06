CREATE DATABASE IF NOT EXISTS belong_db;

USE belong_db;

CREATE TABLE IF NOT EXISTS users  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role ENUM('traveller', 'local') NOT NULL DEFAULT 'traveller',
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles  (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    display_name VARCHAR(100),
    city VARCHAR(100),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS questions (

    id INT AUTO_INCREMENT PRIMARY KEY,

    role ENUM('traveller', 'local') NOT NULL,

    question_text TEXT NOT NULL,

    subtitle TEXT,

    question_type ENUM('single', 'multiple', 'text') DEFAULT 'single',

    display_order INT NOT NULL

);

CREATE TABLE IF NOT EXISTS question_options (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    emoji VARCHAR(20),
    option_title VARCHAR(150) NOT NULL,
    option_description TEXT,
    trait_tags TEXT NULL,
    FOREIGN KEY (question_id)
        REFERENCES questions(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profile_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    question_id INT NOT NULL,
    option_id INT NULL,
    custom_text TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id)
        REFERENCES profiles(id)
        ON DELETE CASCADE,
    FOREIGN KEY (question_id)
        REFERENCES questions(id)
        ON DELETE CASCADE,
    FOREIGN KEY (option_id)
        REFERENCES question_options(id)
        ON DELETE SET NULL
);

INSERT INTO questions
    (role, question_text, subtitle, question_type, display_order)
VALUES
    (
        'traveller',
        'You have 6 hours in a city you have never visited. Where are you going first?',
        'There is no wrong answer. This helps Belong understand your travel personality.',
        'multiple',
        1
    );

INSERT INTO question_options
    (question_id, emoji, option_title, option_description, trait_tags)
VALUES
    (1, '🍜', 'Find the local food', 'I want to taste what locals actually eat.', 'food'),
    (1, '📸', 'Explore hidden places', 'Show me somewhere tourists usually miss.', 'photography,hidden_places'),
    (1, '🏛️', 'Discover the culture', 'Take me somewhere that tells the story of the city.', 'history,culture'),
    (1, '🌿', 'Find nature & peaceful spots', 'I want somewhere calm, beautiful, and away from the crowds.', 'nature,peaceful'),
    (1, '🎉', 'Find the city''s vibe', 'I want music, people, nightlife, and local energy.', 'social,music'),
    (1, '🚶', 'Just walk and explore', 'No fixed plan — let the city surprise me.', 'exploration,spontaneous');

INSERT INTO questions
    (role, question_text, subtitle, question_type, display_order)
VALUES
    (
        'local',
        'What do you actually know or can share with visitors?',
        'Think about your unique knowledge that tourists usually miss.',
        'multiple',
        1
    );

INSERT INTO question_options
(question_id, emoji, option_title, option_description, trait_tags)
VALUES
(2, '🍜', 'Family recipes', 'Share authentic family recipes and local food traditions.', 'food,family'),
    (2, '🏛️', 'Hidden historic places', 'Show visitors the city\'s lesser-known historical gems.', 'hidden_places,history'),
    (2, '📸', 'Undocumented street scenes', 'Guide photography of everyday urban moments and local life.', 'photography,street_life'),
    (2, '🎉', 'Local music venues', 'Take visitors to authentic local music spaces.', 'music,social'),
    (2, '🌿', 'Peaceful local escapes', 'Show where locals go to relax and recharge.', 'nature,peaceful'),
    (2, '🚶', 'Everyday neighborhood walks', 'Guide visitors through daily local life.', 'exploration,street_life'),
    (2, '🏠', 'Local housing stories', 'Share insights about local living and community life.', 'local_life'),
    (2, '🍵', 'Local tea culture', 'Show traditional tea practices and local customs.', 'culture,food'),
    (2, '🛍️', 'Local markets', 'Guide to authentic local markets and street vendors.', 'food,culture'),
    (2, '🚗', 'Local transportation', 'Show where locals actually travel and use transport.', 'local_life'),
    (2, '🏥', 'Healthcare access', 'Guide visitors to local medical facilities and services.', 'local_life'),
    (2, '💼', 'Local business life', 'Show how locals work and do business in the city.', 'local_life');

INSERT INTO questions
    (role, question_text, subtitle, question_type, display_order)
VALUES
    (
        'local',
        'How do you prefer to share your knowledge with visitors?',
        'Think about your natural teaching and sharing style.',
        'single',
        2
    );

INSERT INTO question_options
(question_id, emoji, option_title, option_description, trait_tags)
VALUES
(3, '💬', 'Story-based', 'Share through personal stories and anecdotes.', 'conversation,culture'),
    (3, '👁️', 'Practical demonstration', 'Show by doing and experiencing together.', 'exploration,local_life'),
    (3, '📚', 'Expert presentation', 'Present information in a structured way.', 'history,culture'),
    (3, '🎵', 'Casual conversation', 'Share naturally in relaxed conversation.', 'social,conversation'),
    (3, '👂', 'Listen first', 'Let visitors lead the conversation and discover together.', 'social');

INSERT INTO questions
    (role, question_text, subtitle, question_type, display_order)
VALUES
    (
        'local',
        'What type of travellers do you enjoy spending time with?',
        'Think about who you connect with best.',
        'multiple',
        3
    );

INSERT INTO question_options
    (question_id, emoji, option_title, option_description, trait_tags)
VALUES
    (4, '🧳', 'First-time visitors', 'People experiencing the city for the first time.', 'first_time'),
    (4, '🗺️', 'Return visitors', 'People who have visited before and want deeper experience.', 'return_visitor'),
    (4, '🎭', 'Cultural explorers', 'People interested in authentic culture and traditions.', 'culture'),
    (4, '🏞️', 'Nature seekers', 'People looking for natural escapes and outdoor experiences.', 'nature'),
    (4, '🏢', 'Urban explorers', 'People interested in city life, architecture, and neighborhoods.', 'urban_exploration'),
    (4, '🍽️', 'Food enthusiasts', 'People passionate about local cuisine and dining.', 'food'),
    (4, '📚', 'History buffs', 'People deeply interested in local history and stories.', 'history'),
    (4, '🎨', 'Creative travelers', 'People interested in art, photography, and creative experiences.', 'photography,culture'),
    (4, '🏛️', 'Cultural tourists', 'People visiting traditional attractions and sites.', 'culture'),
    (4, '🛍️', 'Shopping explorers', 'People interested in local markets and shopping experiences.', 'shopping');

    