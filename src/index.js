const express = require('express')
const pg = require('pg')
const app = express()
const PORT = process.argv[2] || 3000

const pool = new pg.Pool({
    "host": "localhost",
    "port": 5432,
    "user":"postgres",
    "password" : "admin",
    "database" : "dummy",
    "max": 20,
    "connectionTimeoutMillis" : 0,
    "idleTimeoutMillis": 0
})


async function startServer() {
    // optimistic concurrency control - using reading latest data again from DB before updating
    app.put('/:id/:name', async function(req, res, next) {
        const id = req.params.id
        const name = req.params.name

        const client = await pool.connect()
        const sql = `SELECT * FROM seats where id = $1 AND is_booked = 0`
        const result = await client.query(sql, [id])
        
        if (result.rowCount === 0) {
            const error = new Error('Seat already booked, please select a different seat')
            return res.status(500).send({
                status: 500,
                error: error.message
            })
        }

        //check if row is updated
        const query = `SELECT * FROM seats where id = $1 AND is_booked = 0`
        const response = await client.query(query, [id])

        if (response.rowCount === 0) {
            client.release();
            const error = new Error('Seat already booked, please select a different seat')
            return res.status(500).send({
                status: 500,
                error: error.message
            })
        }

        const updateQuery = `Update seats set is_booked = 1, username = $2 where id = $1`
        await client.query(updateQuery, [id, name])

        await client.query("COMMIT");
        client.release()

        return res.send('Successfully Booked')
    })


    // PESSIMIST Concurrency control  - using for update
    app.post('/:id/:name', async function(req, res, next) {
        const id = req.params.id
        const name = req.params.name

        const client = await pool.connect()
        const sql = `SELECT * FROM seats where id = $1 AND is_booked = 0 FOR UPDATE`
        const result = await client.query(sql, [id])
        
        if (result.rowCount === 0) {
            const error = new Error('Seat already booked, please select a different seat')
            return res.status(500).send({
                status: 500,
                error: error.message
            })
        }

        const updateQuery = `Update seats set is_booked = 1, username = $2 where id = $1`
        await client.query(updateQuery, [id, name])

        await client.query("COMMIT");
        client.release()

        return res.send('Successfully Booked')
    })
}

app.listen(PORT,() => {
    console.log(`Connected! Listening on port ${PORT}`)
})

startServer()