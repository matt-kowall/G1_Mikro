const sessionId = '1' + Math.random().toString(36).slice(2, 8);

let clickCount = 0,
  focusCount = 0,
  totalFocusTime = 0,
  focusStartTime = null,
  hoverCount = 0,
  totalHoverTime = 0,
  hoverStartTime = null,
  startTime = null,
  endTime = null;
  expandCount = 0,
  collapseCount = 0,
  cityAddedCount = 0,
  detailToggleCount = 0,
  scrolled = 0,
  dateChangeCount = 0,
  scrollTimeout = null;

const entryId = "entry.1425173684";
const apiKey = "44260b731eb28da424ba3deeea4f818a";

const welcome = document.getElementById("welcome"),
  dashboard = document.getElementById("dashboard"),
  startBtn = document.getElementById("startBtn"),
  endBtn = document.getElementById("endBtn"),
  cityInput = document.getElementById("cityInput"),
  addCityBtn = document.getElementById("addCityBtn"),
  cityList = document.getElementById("cityList"),
  weatherResults = document.getElementById("weatherResults");

let useSimulation = false;

startBtn.onclick = () => {
  startTime = Date.now();
  welcome.style.display = "none";
  dashboard.style.display = "block";
  attachFocusListeners();
  attachHoverListeners();
};

window.addEventListener("scroll", () => {
  if (!scrollTimeout) {
    scrolled++;
    scrollTimeout = setTimeout(() => {
      scrollTimeout = null;
    }, 200);
  }
});

dashboard.onclick = () => {
  clickCount++;
};

addCityBtn.onclick = () => {
  clearInputError();
  const city = cityInput.value.trim();
  if (!city) return;

  addTag(city);
  fetchWeather(city);
  cityInput.value = "";
  cityAddedCount++;
};

function addTag(city) {
  const cityNormalized = city.toLowerCase();
  const existingTags = [...cityList.children].map(el =>
    el.dataset.city?.toLowerCase()
  );

  if (existingTags.includes(cityNormalized)) return;

  const tag = document.createElement("div");
  tag.className = "city-tag";
  tag.textContent = city;
  tag.dataset.city = city;

  const rem = document.createElement("span");
  rem.className = "remove";
  rem.textContent = "×";
  rem.onclick = () => {
    tag.remove();
    removeWeather(city);
    clearInputError();
  };

  tag.appendChild(rem);
  cityList.appendChild(tag);
}

function removeWeather(city) {
  const cityLower = city.toLowerCase();
  document.querySelectorAll(".weather-card").forEach(card => {
    if ((card.dataset.city || "").toLowerCase() === cityLower) {
      card.classList.add("fade-out");
      setTimeout(() => card.remove(), 300);
    }
  });
  removeSkeletonLoader(city);
}

async function fetchWeather(city) {
  showSkeletonLoader(city);

  try {
    const resCurrent = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        city
      )}&appid=${apiKey}&units=metric&lang=pl`
    );
    if (!resCurrent.ok) throw new Error("Nie znaleziono miasta");

    const dataCurrent = await resCurrent.json();

    let dataForecast = null;
    try {
      const { lat, lon } = dataCurrent.coord;
      const resForecast = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=pl`
      );
      if (!resForecast.ok) throw new Error("Błąd pobierania prognozy");
      dataForecast = await resForecast.json();
    } catch {
      dataForecast = null;
    }

    removeSkeletonLoader(city);
    showWeather(dataCurrent, dataForecast);
    clearInputError();
  } catch (e) {
    removeSkeletonLoader(city);
    showErrorCard(city, e.message);
    showInputError(`Błąd: ${e.message} — możesz usunąć to miasto klikając ×`);
  }
}

function showWeather(currentData, forecastData) {
  const city = currentData.name;
  removeWeather(city);

  const card = document.createElement("div");
  card.className = "weather-card";
  card.dataset.city = city;

  const { temp, humidity } = currentData.main;
  const desc = currentData.weather[0].description;
  const icon = currentData.weather[0].icon;

  const forecastHTML = useSimulation
    ? createSimulatedForecastHTML()
    : forecastData?.list
      ? createForecastHTML(forecastData)
      : `<p style="text-align:center; font-style: italic; color: #a00; margin-top: 10px;">Prognoza 3-dniowa niedostępna</p>`;

  card.innerHTML = `
    <h3>${city}</h3>
    <p>
      <img src="https://openweathermap.org/img/wn/${icon}@2x.png" class="pulse-icon" alt="${desc}" style="vertical-align: middle; width:40px; height:40px;" />
      Temperatura: ${temp.toFixed(1)}°C
    </p>
    <p>Wilgotność: ${humidity}%</p>
    <p style="text-transform: capitalize;">${desc}</p>
    <div class="forecast-container">${forecastHTML}</div>
    <canvas class="temp-chart" style="width: 100%; height: 30px;"></canvas>
  `;

  weatherResults.appendChild(card);
  requestAnimationFrame(() => card.classList.add("visible"));
  attachHoverListenersToCard(card);
  if (forecastData && forecastData.list) {
    renderTemperatureChart(city, forecastData);
  }
}

function renderTemperatureChart(city, forecastData) {
  const card = document.querySelector(`.weather-card[data-city="${city}"]`);
  if (!card) return;

  const daysMap = {};
  forecastData.list.forEach((entry) => {
    const date = new Date(entry.dt * 1000);
    const dayKey = date.toISOString().split("T")[0];
    if (!daysMap[dayKey]) daysMap[dayKey] = [];
    daysMap[dayKey].push(entry);
  });

  const dayKeys = Object.keys(daysMap).slice(0, 4);

  let switcher = card.querySelector(".day-switcher");
  if (!switcher) {
    switcher = document.createElement("div");
    switcher.className = "day-switcher";
    switcher.style.textAlign = "center";
    switcher.style.marginTop = "10px";
    card.appendChild(switcher);
  }
  switcher.innerHTML = "";

  let chartsContainer = card.querySelector(".charts-container");
  if (!chartsContainer) {
    chartsContainer = document.createElement("div");
    chartsContainer.className = "charts-container";
    card.appendChild(chartsContainer);
  }
  chartsContainer.innerHTML = "";

  const chartTitles = [
    "🌡 Temperatura (°C)",
    "🌧 Opady (mm)",
    "💨 Wiatr (m/s)",
    "💧 Wilgotność (%)",
    "🥵 Odczuwalna (°C)",
    "☁️ Zachmurzenie (%)",
    "🔽 Ciśnienie (hPa)",
  ];

  const dataExtractors = [
    e => e.main.temp.toFixed(1),
    e => (e.rain && e.rain["3h"] ? e.rain["3h"] : 0),
    e => e.wind.speed.toFixed(1),
    e => e.main.humidity,
    e => e.main.feels_like.toFixed(1),
    e => e.clouds.all,
    e => e.main.pressure,
  ];

  const chartContainers = [];

  for (let i = 0; i < chartTitles.length; i++) {
    const wrapper = document.createElement("div");
    wrapper.style.margin = "10px 0";

    const header = document.createElement("div");
    header.className = "chart-toggle";
    header.textContent = chartTitles[i];



    const chartWrapper = document.createElement("div");
    chartWrapper.className = "chart-wrapper";
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.maxWidth = "100%";
    canvas.style.height = "300px";
    chartWrapper.appendChild(canvas);

    wrapper.appendChild(header);
    wrapper.appendChild(chartWrapper);
    chartsContainer.appendChild(wrapper);

    header.onclick = () => {
      detailToggleCount++;

      if (chartWrapper.classList.contains("expanded")) {
        chartWrapper.classList.remove("expanded");
        chartWrapper.classList.add("collapsing");
        chartWrapper.addEventListener("animationend", () => {
          chartWrapper.classList.remove("collapsing");
        }, { once: true });
        collapseCount++;
      } else {
        chartWrapper.classList.add("expanded");
        chartWrapper.classList.remove("collapsing");
        expandCount++;
      }
    };

    chartContainers.push({
      ctx: canvas.getContext("2d"),
      instance: null,
      extractor: dataExtractors[i],
      title: chartTitles[i],
      canvas,
    });
  }

  function drawChartsForDay(dayIndex) {
    const selectedDay = dayKeys[dayIndex];
    const entries = daysMap[selectedDay];
    const labels = entries.map(e =>
      new Date(e.dt * 1000).toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );

    chartContainers.forEach((chart, i) => {
      if (chart.instance) chart.instance.destroy();

      const data = entries.map(chart.extractor);

      chart.instance = new Chart(chart.ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: chart.title,
            data,
            borderColor: "#0288d1",
            backgroundColor: "rgba(2, 136, 209, 0.2)",
            fill: true,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 6,
          }],
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          animation: { duration: 400 },
          scales: {
            y: {
              beginAtZero: false,
              title: { display: true, text: chart.title },
            },
            x: {
              title: { display: true, text: "Godzina" },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: { mode: "index", intersect: false },
          },
        },
      });
    });
  }

  dayKeys.forEach((day, i) => {
    const btn = document.createElement("button");
    btn.className = "day-switcher";
    const date = new Date(day);
    const label = i === 0 ? "Dziś" : date.toLocaleDateString("pl-PL", {
      weekday: "short", day: "numeric", month: "numeric"
    });

    btn.textContent = label;
    btn.style.background = i === 0 ? "#0288d1" : "white";
    btn.style.color = i === 0 ? "white" : "#0288d1";


    btn.onclick = () => {
      dateChangeCount++;
      [...switcher.children].forEach(b => {
        b.style.background = "white";
        b.style.color = "#0288d1";
      });
      btn.style.background = "#0288d1";
      btn.style.color = "white";

      drawChartsForDay(i);
    };
    switcher.appendChild(btn);
  });

  drawChartsForDay(0);
}

endBtn.classList.add('clicked');
setTimeout(() => endBtn.classList.remove('clicked'), 500);

function createForecastHTML(forecastData) {
  const daysMap = {};
  forecastData.list.forEach(entry => {
    const date = new Date(entry.dt * 1000);
    const dayKey = date.toISOString().split("T")[0];
    if (!daysMap[dayKey]) daysMap[dayKey] = [];
    daysMap[dayKey].push(entry);
  });

  return Object.entries(daysMap)
    .slice(1, 4)
    .map(([day, entries]) => {
      const avgTemp =
        entries.reduce((sum, e) => sum + e.main.temp, 0) / entries.length;

      const descriptions = entries.map(e => e.weather[0].description);
      const icons = entries.map(e => e.weather[0].icon);

      const mostCommon = arr =>
        arr.sort(
          (a, b) => arr.filter(v => v === b).length - arr.filter(v => v === a).length
        )[0];

      const mostCommonDesc = mostCommon(descriptions);
      const mostCommonIcon = mostCommon(icons);

      const dateStr = new Date(day).toLocaleDateString("pl-PL", {
        weekday: "short",
        day: "numeric",
        month: "numeric",
      });

      return `
        <div class="forecast-day">
          <div class="forecast-date">${dateStr}</div>
          <div class="forecast-temp">${avgTemp.toFixed(1)}°C</div>
          <div class="forecast-desc" style="text-transform: capitalize;">
            <img src="https://openweathermap.org/img/wn/${mostCommonIcon}@2x.png" alt="${mostCommonDesc}" style="display:block; margin:0 auto; vertical-align: middle; justify-content: conwidth:40px; height:40px;"/>
            ${mostCommonDesc}
          </div>
        </div>
      `;
    })
    .join("");
}

function showSkeletonLoader(city) {
  const exists = [...weatherResults.children].some(
    el => el.dataset.city === city && el.classList.contains("loading")
  );
  if (exists) return;

  const loader = document.createElement("div");
  loader.className = "weather-card loading";
  loader.dataset.city = city;
  loader.innerHTML = `
    <div class="skeleton-title"></div>
    <div class="skeleton-line"></div>
    <div class="skeleton-line short"></div>
    <div class="skeleton-forecast">
      <div class="skeleton-day"></div>
      <div class="skeleton-day"></div>
      <div class="skeleton-day"></div>
    </div>
  `;
  weatherResults.appendChild(loader);
}

function removeSkeletonLoader(city) {
  document.querySelectorAll(`.weather-card.loading[data-city="${city}"]`).forEach(el => el.remove());
}

function showErrorCard(city, message) {
  removeWeather(city);
  const card = document.createElement("div");
  card.className = "weather-card error";
  card.dataset.city = city;
  card.innerHTML = `<h3>${city}</h3><p style="color: #a00;">${message}</p>`;
  weatherResults.appendChild(card);
  requestAnimationFrame(() => card.classList.add("visible"));
}

function showInputError(msg) {
  cityInput.setCustomValidity(msg);
  cityInput.reportValidity();
}
function clearInputError() {
  cityInput.setCustomValidity("");
  cityInput.reportValidity();
}

function onFocus() {
  focusCount++;
  focusStartTime = Date.now();
}
function onBlur() {
  if (focusStartTime) {
    totalFocusTime += Date.now() - focusStartTime;
    focusStartTime = null;
  }
}
function attachFocusListeners() {
  cityInput.addEventListener("focus", onFocus);
  cityInput.addEventListener("blur", onBlur);
}

function onHoverEnter() {
  hoverCount++;
  hoverStartTime = Date.now();
}
function onHoverLeave() {
  if (hoverStartTime) {
    totalHoverTime += Date.now() - hoverStartTime;
    hoverStartTime = null;
  }
}
function attachHoverListeners() {
  [startBtn, endBtn, addCityBtn].forEach(btn => {
    btn.addEventListener("mouseenter", onHoverEnter);
    btn.addEventListener("mouseleave", onHoverLeave);
  });

  cityList.querySelectorAll(".city-tag").forEach(tag => {
    tag.addEventListener("mouseenter", onHoverEnter);
    tag.addEventListener("mouseleave", onHoverLeave);
  });

  document.querySelectorAll(".weather-card").forEach(card => {
    card.addEventListener("mouseenter", onHoverEnter);
    card.addEventListener("mouseleave", onHoverLeave);
  });
}

function attachHoverListenersToCard(card) {
  card.addEventListener("mouseenter", onHoverEnter);
  card.addEventListener("mouseleave", onHoverLeave);
}

endBtn.onclick = () => {
  endTime = Date.now();

  if (focusStartTime) totalFocusTime += Date.now() - focusStartTime;
  if (hoverStartTime) totalHoverTime += Date.now() - hoverStartTime;

  const timeSpentSec = ((endTime - startTime) / 1000).toFixed(2);
  const totalFocusTimeSec = (totalFocusTime / 1000).toFixed(2);
  const totalHoverTimeSec = (totalHoverTime / 1000).toFixed(2);

  const dataStr = `id:${sessionId},cc:${clickCount},t:${timeSpentSec},h:${hoverCount},ht:${totalHoverTimeSec},f:${focusCount},ft:${totalFocusTimeSec},ec:${expandCount},ccoll:${collapseCount},ca:${cityAddedCount},dt:${detailToggleCount},dch:${dateChangeCount},scr:${scrolled}`;
  const url = `https://docs.google.com/forms/d/e/1FAIpQLScMj5msYYeJYUqh_qckNpDrnf7E0DS20qFzkzUvYkiozqCU3g/viewform?${entryId}=${encodeURIComponent(dataStr)}`;

  window.open(url, "_blank");
};

weatherResults.addEventListener("click", e => {
  if (e.target.tagName === "IMG") {
    e.target.classList.add("clicked-icon");
    setTimeout(() => e.target.classList.remove("clicked-icon"), 300);
  }
});



