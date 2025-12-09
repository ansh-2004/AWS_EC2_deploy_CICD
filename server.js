const express = require('express')
const app = express()
require('dotenv').config()



app.get('/api/get',(req,res)=>{
    res.send(
        `<h1> API IS WORKING FINE </h1>`
    )
})

app.listen(process.env.port,()=>{
    console.log(`Server is running on port ${process.env.port}`)
})