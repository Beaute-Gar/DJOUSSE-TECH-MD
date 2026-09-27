const botImages = [
    'media/djousse.jpg',
];

function randomImage() {
    return botImages[Math.floor(Math.random() * botImages.length)];
}

module.exports = { botImages, randomImage };
