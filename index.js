const electron = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const _ = require('lodash');

const { app, BrowserWindow, ipcMain, shell } = electron;

let mainWindow;

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: { backgroundThrottling: false }
  });

  mainWindow.loadURL(`file://${__dirname}/src/index.html`);
});

ipcMain.on('videos:added', (event, videos) => {
  // console.log(videos);
  // const promise = new Promise((resolve, reject) => {
  //   ffmpeg.ffprobe(videos[0].path, (err, metadata) => {
  //     // console.log(metadata);
  //     resolve(metadata);
  //   });
  // });
  //
  // promise.then(metadata => {
  //   console.log(metadata);
  // });

  const promises = _.map(videos, video => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(video.path, (err, metadata) => {
        // resolve(metadata);
        video.duration = metadata.format.duration;
        video.format = 'avi';
        // setting the output default format for the video after it is converted...just a side effect of the app
        // not really anything related to video metadata processing from ffprobe
        // that 'avi' will be selected as the default conversion format in the app

        resolve(video);

        // ES6 spread syntax
        // resolve({
        //   ...video,
        //   duration: metadata.format.duration,
        //   format: 'avi'
        // });
      });
    });
  });

  Promise.all(promises).then(results => {
    // console.log(results);
    mainWindow.webContents.send('metadata:complete', results);
  });
});

ipcMain.on('conversion:start', (event, videos) => {
  // console.log(videos);

  // video conversion can be long depending on video size
  // we want to finish these videos as they finish converting,
  // no need for Promise.all to wait for all the videos to convert and then do something about it

  _.each(videos, video => {
    const outputDirectory = video.path.split(video.name)[0];
    // /Users/panaik/Downloads/

    const outputName = video.name.split('.')[0];
    // Sample Video

    const outputPath = `${outputDirectory}${outputName}.${video.format}`;
    // if the conversion format was set to 'mp4' then outputPath would be
    // /Users/panaik/Downloads/Sample Video.mp4

    //console.log(outputDirectory, outputName, outputPath);

    ffmpeg(video.path)
      .output(outputPath)
      // .on('progress', event => {
      .on('progress', ({ timemark }) => {
        // console.log(event);
        // event contains: frames that have been processed so far, currentFps, currentKbps,
        // target size, timemark (how far through the video we far) and percent (actual percent conversion completed)
        // we use the progress event (timemark) on the React side to show the nice progressBar backgroundColor animation

        mainWindow.webContents.send('conversion:progress', { video, timemark });
      })
      .on('end', () => {
        // console.log('Video conversion complete.');
        mainWindow.webContents.send('conversion:end', { video, outputPath });
      })
      .run();
  });
});

ipcMain.on('folder:open', (event, outputPath) => {
  shell.showItemInFolder(outputPath);
  // this will cause to open the finder window where the converted video is saved at
  // and highlights the file
});
