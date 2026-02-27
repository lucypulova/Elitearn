// Конфигурация на връзката към MySQL база данни чрез mysql2 (promise версия).

const mysql = require("mysql2/promise"); 
// Използваме promise API-то на mysql2, за да можем да работим с async/await.

require("dotenv").config(); 
// Зареждаме променливите от .env файла (DB_HOST, DB_USER и др.).

/**
 * Създаваме connection pool.
 * Pool-ът управлява множество връзки към базата,
 * което е по-ефективно от създаване на нова връзка при всяка заявка.
 */
const pool = mysql.createPool({
    host: process.env.DB_HOST,        // Адрес на MySQL сървъра
    user: process.env.DB_USER,        // Потребителско име
    password: process.env.DB_PASSWORD || "", // Парола (по избор)
    database: process.env.DB_NAME,    // Име на базата данни

    waitForConnections: true, 
    // Ако всички връзки са заети, новите заявки ще чакат.

    connectionLimit: 10, 
    // Максимален брой едновременни връзки към базата.
});

/**
 * Експортираме pool-а,
 * за да може да се използва в други файлове (например worker, routes и т.н.).
 */
module.exports = { pool };