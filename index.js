const getYouTubeID = require('get-youtube-id');
const mustacheExpress = require('mustache-express');
const port = 3000;
const express = require('express')
const app = express()

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
				console.log('Nothing to process');
				delay = 4000;
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

function sleep(delay) {
	return new Promise((resolve) => {
		setTimeout(resolve, delay)
	})
}


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

	responseData.audioReady = responseData.job.status === 'finished';
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
		status: Sequelize.STRING
	});

	Video.hasOne(VideoJob);
	VideoJob.belongsTo(Video);

	return await sequelize.sync({
		force: shouldDropTables ? true : false,
		logging: false
	});
}

async function init() {
	await setupDB();
	queue.handle(async video => {
		console.log('\nvideo received', video.get().video_id);
		const job = await video.getVideoJob();
		job.update({
			status: 'resolved'
		});
	});
}

init();

app.listen(port, () => console.log(`Server started on port: ${port}`));