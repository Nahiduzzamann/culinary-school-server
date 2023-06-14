const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_KEY)
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


//middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gzflvsa.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();


        const classesCartCollection = client.db("culinarySchoolDb").collection("classesCartCollection");
        const usersCollection = client.db("culinarySchoolDb").collection("usersCollection");
        const instructorClassCollection = client.db("culinarySchoolDb").collection("instructorClassCollection");


        ///instructor class
        app.post('/instructorClass', async (req, res) => {
            const item = req.body;
            const result = await instructorClassCollection.insertOne(item);
            res.send(result);
        })
        app.get('/classes/approved', async (req, res) => {
            const query = { status: 'approved' };
            const classes = await instructorClassCollection.find(query).toArray();
            res.json(classes);

        });

        app.get('/instructorClass', async (req, res) => {
            const result = await instructorClassCollection.find().toArray();
            res.send(result);
        });
        app.patch('/instructorClass/:id', async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: status,
                    students: [],
                },
            };
            const result = await instructorClassCollection.updateOne(filter, updateDoc);
            res.send(result);

        })
        app.patch('/enroll/:id', async (req, res) => {
            const id = req.params.id;
            const { email } = req.body;
            const filter = { _id: new ObjectId(id) };
            const selectedClasses = await instructorClassCollection.findOne(filter);

            try {
                if (!selectedClasses.students?.includes(email)) {
                    const update = selectedClasses.students.push(email)
                    const result = await instructorClassCollection.updateOne(update);
                    res.send(result);
                }
            }catch(e){
                res.send('not update');
            }

        })

        // app.patch('/instructorClass/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const { email } = req.body;
        //     const selectedClasses =await instructorClassCollection.find().toArray();
        //     // Check if the class exists in the selectedClasses object
        //     if (selectedClasses[id]) {
        //       // If the class exists, check if the email is already in the array
        //       if (!selectedClasses[id].includes(email)) {
        //         // If the email is not already in the array, add it
        //         selectedClasses[id].push(email);
        //       }
        //     } else {
        //       // If the class doesn't exist, create a new array with the email and assign it to the class
        //       selectedClasses[id] = [email];
        //     }

        //     const filter = { _id: new ObjectId(id) };
        //     const updateDoc = {
        //       $set: {
        //         status: req.body.status,
        //         students: selectedClasses[id] || [],
        //       },
        //     };

        //     const result = await instructorClassCollection.updateOne(filter, updateDoc);
        //     res.send(result);
        //   });
        app.patch('/instructorClassFeedback/:classId', async (req, res) => {

            const classId = req.params.classId;
            const { adminFeedback } = req.body;
            const filter = { _id: new ObjectId(classId) };
            const updateDoc = {
                $set: {
                    adminFeedback: adminFeedback,
                },
            };

            const result = await instructorClassCollection.updateOne(filter, updateDoc);
            res.json(result);
        })


        // users related
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });
        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id;
            const { role } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: role,
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })


        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;

            // if (req.decoded.email !== email) {
            //     res.send({ admin: false })
            // }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { user }
            res.send(result);
        })

        // cart collection apis
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            const query = { email: email };
            const result = await classesCartCollection.find(query).toArray();
            res.send(result);
        });

        //cart post
        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await classesCartCollection.insertOne(item);
            res.send(result);
        })
        const selectedCarts = {};

        app.get('/cart/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCartCollection.findOne(query);
            res.send(result);
        });

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCartCollection.deleteOne(query);
            res.send(result);
        })
        app.get('/carts/:email', async (req, res) => {
            const email = req.params.email;

            const query = { email: email }
            const user = await classesCartCollection.findOne(query);
            const result = { user }
            res.send(result);
        })


        // create payment intent
        app.post('/payment', async (req, res) => {
            const { paymentMethodId, amount } = req.body;

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount,
                    currency: 'usd',
                    payment_method: paymentMethodId,
                    confirm: true,
                });

                res.status(200).json({ success: true });
            } catch (error) {
                console.log('Error:', error);
                res.status(500).json({ error: 'An error occurred while processing the payment.' });
            }
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Server Running')
})
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})