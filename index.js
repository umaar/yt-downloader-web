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

app.get('/details/:id', async (req, res) => {
	const id = req.params.id;

	if (!id) {
		return res.redirect(302, '/');
	}

	let videoMatch = await Video.findOne({
		where: {
			video_id: id
		}
	});

	const responseData = {
		justCreated: false,
		title: 'Video Details',
		id
	};

	if (videoMatch) {
		console.log('Video found!');
		const job = await videoMatch.getVideoJob();

		responseData.video = videoMatch.get();

		if (job) {
			responseData.job = job.get();
		}
	} else {
		const video = await Video.create({
			video_id: id,
			video_provider: 'youtube',
			video_duration: 200
		});

		const job = await video.createVideoJob({
			status: 'queued'
		});

		responseData.video = video.get();
		responseData.job = job.get();
		responseData.justCreated = true;
	}

	responseData.jobsLength = await VideoJob.count();

	console.log(responseData);
	res.render('details', responseData);
});








async function setupDB() {
	const shouldDropTables = true;
	const Sequelize = require('sequelize');
	const sequelize = new Sequelize('database', 'username', 'password', {
		storage: __dirname + '/database.sqlite',
		host: 'localhost',
		dialect: 'sqlite'
	});

	Video = sequelize.define('video', {
		video_id: {
			type: Sequelize.STRING,
			allowNull: false,
			unique: true,
		},
		video_provider: Sequelize.STRING,
		video_duration: Sequelize.INTEGER
	});

	VideoJob = sequelize.define('videoJob', {
		foo: Sequelize.STRING,
		status: Sequelize.STRING
	});

	Video.hasOne(VideoJob);
	VideoJob.belongsTo(Video);

	return await sequelize.sync({
		force: shouldDropTables ? true : false,
		logging: false
	});
}

async function dbTest() {
	const video1 = await Video.create({
		video_id: 'zzzzz',
		video_provider: 'youtube',
		video_duration: 100
	});

	const video2 = await Video.create({
		video_id: 'aaabbb',
		video_provider: 'youtube',
		video_duration: 200
	});

	const videoJob1 = await video2.createVideoJob({
		foo: 'wahoo',
		status: 'queued',
	});

	const videoQuery = await Video.findOne({
		where: {
			video_id: 'aaabbb'
		}
	});

	const jobQuery = await VideoJob.findOne({
		where: {
			id: 1
		}
	});

	// console.log(videoQuery.get());
	// console.log((await videoQuery.getVideoJob()).get());
	// console.log('\n\n');
	// console.log((await jobQuery.getVideo()).get());
	// console.log(video1.constructor.prototype);
}

async function init() {
	await setupDB();
	// await dbTest();
}

init();

app.listen(port, () => console.log(`Server started on port: ${port}`));