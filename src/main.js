import './style.css'; // 告訴 Vite 要載入你的 CSS

// 宣告變數來裝載入的地圖資料
let coordData;

// p5.js 的預先載入函式
function preload() {
  // 把你的 coordinates.json 放在 public 資料夾下
  coordData = loadJSON('/coordinates.json');
}

// p5.js 的初始化函式
function setup() {
  // 建立畫布並放到右側的容器裡
  let canvas = createCanvas(800, 600);
  canvas.parent('canvas-container'); 
  
  // 在終端機/開發者工具印出資料，確認有沒有讀到
  console.log("地圖資料載入成功：", coordData); 
}

// p5.js 的繪圖迴圈
function draw() {
  background(240); // 畫一個淺灰色的背景

  // 設定繪圖樣式：紅色圓點，沒有外框
  fill(255, 0, 0); 
  noStroke();

  // 假設台大的經緯度範圍 (這需要根據你的資料動態計算或手動校準)
  // 你可以先用這組數字試試看
  let minLon = 121.533, maxLon = 121.545;
  let minLat = 25.012, maxLat = 25.022;

  // 如果資料有成功載入，就把每一個節點畫出來
  if (coordData) {
    for (let id in coordData) {
      let [lon, lat] = coordData[id];

      // 將經緯度轉為畫布上的 X, Y (注意 Y 軸的 Max 和 Min 要反過來)
      let x = map(lon, minLon, maxLon, 0, width);
      let y = map(lat, maxLat, minLat, 0, height); 

      // 渲染圓圈，大小設定為 5
      circle(x, y, 5); 
    }
  }
}

// 將 p5 的核心函式掛載到全域，這樣 Vite 環境下才能正常執行 p5.js
window.preload = preload;
window.setup = setup;
window.draw = draw;