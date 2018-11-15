const getYouTubeID = require('get-youtube-id');
const mustacheExpress = require('mustache-express');
const port = 3000;
const express = require('express');
const app = express();

const YoutubeMp3Downloader = require('youtube-mp3-downloader');

const YD = new YoutubeMp3Downloader({
    'ffmpegPath': '/usr/local/bin/ffmpeg',
    'outputPath': '/Users/umarhansa/Downloads/yt-downloader-web/audio',
    'youtubeVideoQuality': 'highest',
    'queueParallelism': 1,
    'progressTimeout': 500
});

// todo globalise me
YD.on('progress', data => {
	const percentage = Math.round(data.progress.percentage);
	console.log('prog::: ', data);
});

let Video;
let VideoJob;

async function getNextItem() {
	const jobQuery = await VideoJob.findOne({
		where: {
			status: 'queued'
		}
	});

	if (jobQuery) {
		return await jobQuery.getVideo();
	}
}

const queue = {
	handler: undefined,
	running: false,
	startProcessing() {
		setTimeout(async function() {
			let delay;
			const item = await getNextItem();

			if (item) {
				await queue.handler(item);
				delay = 1000;
			} else {
				delay = 2000;
			}

			setTimeout(queue.startProcessing, delay);
		}, 10);
	},
	handle(fn) {
		queue.handler = fn;

		if (!queue.running) {
			queue.running = true;
			queue.startProcessing();
		}
	}
};

app.engine('mustache', mustacheExpress());
app.set('view engine', 'mustache');
app.set('layout', 'layout');
app.set('views', __dirname + '/views');
app.use(express.static('public'))

function extractIDFromUrl(url) {
	return getYouTubeID(url, {fuzzy: false});
}

app.get('/', (req, res) => {
	const exampleYouTubeUrls = [
		'https://www.youtube.com/watch?v=Jv1ZN8c4_Gs',
		'https://www.youtube.com/watch?v=E-6xk4W6N20',
		'https://www.youtube.com/watch?v=U6y7YOlldek'
	];

	res.render('index', {
		title: 'Home',
		exampleYouTubeUrls: exampleYouTubeUrls.map(url => ({
			rawUrl: url,
			url: '/details?ytUrl=' + escape(url)
		}))
	});
});

app.get('/details', (req, res) => {
	const id = extractIDFromUrl(req.query['ytUrl']);

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

	responseData.audioReady = responseData.job.status === 'resolved';
	res.render('details', responseData);
});

async function setupDB() {
	const shouldDropTables = true;
	const Sequelize = require('sequelize');
	const sequelize = new Sequelize('database', 'username', 'password', {
		storage: __dirname + '/database.sqlite',
		host: 'localhost',
		dialect: 'sqlite',
		logging: false
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
		execution_time: Sequelize.INTEGER,
		status: Sequelize.STRING,
		percentage: Sequelize.INTEGER
	});

	Video.hasOne(VideoJob);
	VideoJob.belongsTo(Video);

	return await sequelize.sync({
		force: shouldDropTables ? true : false,
		logging: false
	});
}

function sleep(ms) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, ms);
	});
}

function downloadYtVideo(id, progressCallback) {
	return new Promise((resolve, reject) => {
		YD.download(id, id + '.mp3');

		// these need to be global callbacks
		YD.on('finished', () => resolve());
		// these need to be global callbacks
		YD.on('error', error => reject(error));

		// YD.on('progress', data => {
		// 	const percentage = Math.round(data.progress.percentage);
		// 	progressCallback(percentage)
		// });
	});
}

async function videoHandler(video) {
	const startTime = new Date();

	console.log('\nvideo received', video.get().video_id);
	const job = await video.getVideoJob();

	await job.update({
		status: 'processing'
	});

	try {
		await downloadYtVideo(video.get().video_id, percentage => {
			job.update({
				percentage
			});
		});
	} catch (err) {
		console.log('Error downloading video:', err);
	}

	const endTime = new Date();

	await job.update({
		status: 'resolved',
		execution_time: endTime - startTime
	});
}

async function init() {
	await setupDB();
	queue.handle(videoHandler);
}

init();

app.listen(port, () => console.log(`\n➡ http://localhost:3000/`));