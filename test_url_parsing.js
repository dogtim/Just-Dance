
const urls = [
    'https://www.youtube.com/watch?v=jWQx2f-CErU',
    'https://youtu.be/jWQx2f-CErU',
    'https://www.youtube.com/shorts/PucaCQG8L18',
    'https://www.youtube.com/shorts/PucaCQG8L18?feature=share'
];

urls.forEach(url => {
    let id = '';
    try {
        if (url.includes('v=')) {
            id = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            id = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('shorts/')) {
            id = url.split('shorts/')[1].split('?')[0];
        }
    } catch (e) {
        console.error(e);
    }
    console.log(`URL: ${url} -> ID: ${id}`);
});
