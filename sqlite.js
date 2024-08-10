// npm install sqlite3
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('players.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

/**
 * Create a table if it doesn't exist
 */
db.run(`
    CREATE TABLE IF NOT EXISTS players (
        player_id INTEGER PRIMARY KEY AUTOINCREMENT, 
        discord_id INTEGER NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0,
        UNIQUE(discord_id)
    );
    `, (err) => {
    if (err) {
        console.error('Error creating table:', err.message);
    } else {
        console.log('Table created or already exists.');
    }
});

// Do NOT need to ever call. Automatically adds a player if they don't exist in the database
const checkPlayer = (discord_id) => {
    return new Promise((resolve, reject) => {
        const checkQuery = `SELECT * FROM players WHERE discord_id = ?`;
        db.get(checkQuery, [discord_id], (err, row) => {
            if (err) {
                return reject('Error checking player: ' + err.message);
            }
            if (!row) {
                const addQuery = `INSERT INTO players (discord_id, balance) VALUES (?, 100)`;
                db.run(addQuery, [discord_id], function(err) {
                    if (err) {
                        return reject('Error inserting player: ' + err.message);
                    }
                    //console.log(`Player with discord_id ${discord_id} added.`);
                    resolve(); // Player added, resolve the promise
                });
            } else {
                resolve(); // Player already exists, resolve the promise
            }
        });
    });
};

// Retrieves the balance of the interacting player
const retrieveBalance = async (discord_id) => {
    try {
        await checkPlayer(discord_id);
        const getQuery = `SELECT balance FROM players WHERE discord_id = ?`;
        const balance = await new Promise((resolve, reject) => {
            db.get(getQuery, [discord_id], (err, row) => {
                if (err) {
                    return reject('Error retrieving balance: ' + err.message);
                }
                if (row) {
                    //console.log(`Balance for player: ${row.balance}`);
                    resolve(row.balance);
                } else {
                    console.log('Player not found.');
                    resolve(null);
                }
            });
        });

        return balance;
    } catch (error) {
        console.error(error);
    }
};

// Updates the balance of the interacting player
const updateBalance = async (discord_id, amount) => {
    try {
        await checkPlayer(discord_id);

        const currentBalance = await retrieveBalance(discord_id);
        const updateQuery = 'UPDATE players SET balance = ? WHERE discord_id = ?';
        const newBalance = currentBalance + amount;
        const query = new Promise((resolve, reject) => {
            db.run(updateQuery, [newBalance, discord_id], function(err) {
                if (err) {
                    return reject('Error updating balance: ' + err.message);
                }
                //console.log(`Balance for player with discord_id ${discord_id} updated to ${newBalance}.`);
                resolve(newBalance);
            });
        });

        return newBalance;
    } catch (error) {
        console.error(error);
    }
};

module.exports = {
    retrieveBalance,
    updateBalance,
    db // Probably Don't Need But :3
};