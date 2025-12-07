process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '0';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
