const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_KEY);
const app = express()
const port = process.env.PORT || 8000;

// middlewares
app.use(cors())
app.use(express.json())

// send email
const sendMail = (emailData, email) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: emailData?.subject,
        html: `<p>${emailData.message}</p>`
    };
    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
            // do something useful
        }
    });
}

// Database Connection
const uri = process.env.DB_URI;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
})

async function run() {
    try {
        const homesCollection = client.db('aircnc').collection('homes');
        const userCollection = client.db('aircnc').collection('users');
        const bookingsCollection = client.db('aircnc').collection('bookings');
        // save user email & generate jwt
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ token, result })

        })
        // get single us
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user)
        })
        // get all user
        app.get('/users', async (req, res) => {
            const query = {};
            const users = await userCollection.find(query).toArray();
            res.send(users)
        })

        // create booking
        app.post('/bookings', async (req, res) => {
            const bookingData = req.body;
            const results = await bookingsCollection.insertOne(bookingData);
            sendMail(
                {
                    subject: 'Booking successful!',
                    message: `Booking Id: ${results.insertedId}`
                },
                bookingData?.guestEmail
            )
            res.send(results)
        })

        // getAll bookings
        app.get('/bookings', async (req, res) => {
            let query = {};
            const email = req.query.email;
            if (email) {
                query = { guestEmail: email }
            }
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        })

        app.post('/create-payment-intent', async(req, res)=> {
            const price = req.body.price;
            const amount = parseFloat(price) * 100;
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_type: ['card']
                })
                res.send({clientSecret: paymentIntent.client_secret})
            } catch (err) {
                console.log(err)
            }
        })
        // add home
        app.post('/homes', async (req, res) => {
            const homeData = req.body;
            // console.log(homeData)
            const results = await homesCollection.insertOne(homeData);
            res.send(results)
        })
        app.get('/homes', async (req, res) => {
            const allHome = await homesCollection.find({}).toArray();
            res.send(allHome);
        })
        app.get('/homes/:id', async (req, res) => {
            
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const home = await homesCollection.findOne(query);
            res.send(home);
        })
        app.get('/search-result', async (req, res)=>{
            const query = {};
            const location = req.query.location;
            if(location)query.location = location;
            // const from = req.query.from;
            // if(from)query.from = from;
            // const to = req.query.to;
            // if(to)query.to = to;
            const cursor = homesCollection.find(query);
            const homes = await cursor.toArray();
            res.send(homes);
        })
        console.log('Database Connected...')
    } finally {

    }
}



run().catch(err => console.error(err))

app.get('/', (req, res) => {
    res.send('Server is running...')
})

app.listen(port, () => {
    console.log(`Server is running...on ${port}`)
})