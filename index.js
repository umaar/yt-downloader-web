const getYouTubeID = require('get-youtube-id');
const mustacheExpress = require('mustache-express');

const port = 3000;

var express = require('express')
var app = express()

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
		title: 'Hey',
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
		title: 'Hey',
		id
	});
});


app.listen(port, () => console.log(`Server started on port: ${port}`));