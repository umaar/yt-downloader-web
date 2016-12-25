const getYouTubeID = require('get-youtube-id');
const mustacheExpress = require('mustache-express');
const port = 3000;
const express = require('express')
const app = express()
let Video;
let VideoJob;

app.engine('mustache', mustacheExpress());
app.set('view engine', 'mustache');
app.set('layout', 'layout');
app.set('views', __dirname + '/views');
app.use(express.static('public'))

function extractIDFromUrl(url) {
	return getYouTubeID(url, {fuzzy: false});
}

app.get('/', (req, res) => {
	res.render('index', {
		title: 'Home',
	});
});

app.get('/details', (req, res) => {
	const id = extractIDFromUrl(req.query.url);

	if (!id) {
		return res.redirect(302, '/');
	}

	return res.redirect(302, '/details/' + id);
});

app.get('/details/:id', (req, res) => {
	const id = req.params.id;

	if (!id) {
		return res.redirect(302, '/');
	}

	res.render('details', {
		title: 'Video Details',
		id
	});
});

const Sequelize = require('sequelize');
const sequelize = new Sequelize('database', 'username', 'password', {
	storage: __dirname + '/database.sqlite',
	host: 'localhost',
	dialect: 'sqlite'
});

const shouldDropTables = true;

async function setupDB() {
	Video = sequelize.define('video', {
		video_id: {
			type: Sequelize.STRING,
			allowNull: false,
			unique: true,
		},
		video_provider: Sequelize.STRING,
		video_duration: Sequelize.INTEGER
	});

	VideoJob = sequelize.define('video_job', {
		foo: Sequelize.STRING,
		status: Sequelize.STRING
	});

	Video.belongsTo(VideoJob);

	sequelize.sync({
		force: shouldDropTables ? true : false
	});
}

async function init() {
	setupDB();
}

async function dbTest() {
	const video1 = await Video.create({
		video_id: 'fdsgfdg',
		video_provider: 'youtube',
		video_duration: 100
	});

	const videoJob1 = await VideoJob.create({
		foo: 'hello, the relationship works!',
		status: 'queued'
	});

	const video2 = await Video.create({
		video_id: 'aaabbb',
		video_provider: 'youtube',
		video_duration: 200,
		videoJobId: videoJob1.id
	});

	const videoQuery = await Video.findOne({
		where: {
			video_id: 'aaabbb'
		}
	});

	console.log(videoQuery.get());
	console.log((await videoQuery.getVideo_job()).get());

	const jobQuery = await VideoJob.findOne({
		where: {
			id: 1
		}
	});
	console.log('\n\n');
	console.log((await getVideoFromJob(Video, jobQuery.id)).get());
}

async function getVideoFromJob(VideoModel, jobId) {
	return await VideoModel.findOne({
		where: {
			videoJobId: jobId
		}
	});
}

// dbTest();


app.listen(port, () => console.log(`Server started on port: ${port}`));