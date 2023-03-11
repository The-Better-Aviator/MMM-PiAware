Module.register('MMM-PiAware', {
  // This object stores default configuration values
  defaults: {
    piAwareAddress: null,
    showLocation: true,
    size: 500,
    targetSize: 10,
    rangeRings: [50, 100, 150, 200, 250, 300],
    showIdBlock: true,
    useFade: true,
    showAlt: false,
    showSpeed: false,
    lineFeatures: null,
    lat: 0,
    lon: 0,
  },
  maxMMzIndex: 1000,
  loaded: false,
  domCreated: false,
  isMapSet: false,
  mapObject: null,
  aircraft: null,
  aircraftGroup: null,
  ringsGroup: null,
  polylineGroup: null,
  // This function will be executed when your module loads successfully
  start: function () {},
  // This function renders your content on MM screen
  getDom: function () {
    if (this.config.piAwareAddress === null) {
      let notificationDiv = document.createElement('div');
      notificationDiv.className = 'bright';
      notificationDiv.style.width = `${this.config.size}px`;
      notificationDiv.style.height = `${this.config.size}px`;
      notificationDiv.innerHTML =
        '<em>Please set your PiAware IP Address.</em>';
      return notificationDiv;
    } else {
      if (!this.loaded) {
        this.loaded = true;

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.onload = () => {
          this.updateDom();
        };
        script.src = 'https://unpkg.com/leaflet@1.5.1/dist/leaflet.js';
        document.querySelector('head').appendChild(script);
        return document.createElement('span');
      }
      let mapArea = document.createElement('div');
      mapArea.id = 'map';
      mapArea.style.width = `${this.config.size}px`;
      mapArea.style.height = `${this.config.size}px`;

      return mapArea;
    }
  },
  getStyles() {
    return [
      this.file('MMM-PiAware.css'),
      this.file('css/leaflet_override.css'),
    ];
  },
  notificationReceived: function (notification, payload, sender) {
    switch (notification) {
      case 'DOM_OBJECTS_CREATED':
        this.domCreated = true;
        this.fetchData(
          'MMM_PIAWARE_RECEIVER',
          `${this.config.piAwareAddress}/data/receiver.json`
        );
        this.fetchData(
          'MMM_PIAWARE_AIRCRAFT',
          `${this.config.piAwareAddress}/data/aircraft.json`
        );
        setInterval(() => {
          this.fetchData(
            'MMM_PIAWARE_AIRCRAFT',
            `${this.config.piAwareAddress}/data/aircraft.json`
          );
        }, 1000);
        break;
    }
  },
  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case 'MMM_PIAWARE_RECEIVER_REC':
        if (this.config.lat === 0) {
          if ('lat' in payload && 'lon' in payload) {
            this.config.lat = payload.lat;
            this.config.lon = payload.lon;
          }
        }
        break;
      case 'MMM_PIAWARE_AIRCRAFT_REC':
        this.aircraft = payload.aircraft;
        if (this.domCreated && this.config.lat !== null && !this.isMapSet) {
          this.drawMap();
        } else {
          this.drawTargets();
        }
        break;
      case 'MMM_PIAWARE_ERROR':
        break;
    }
  },
  fetchData(sendEvent, payload) {
    this.sendSocketNotification(sendEvent, payload);
  },
  drawTargets() {
    this.aircraftGroup.clearLayers();
    let targetDot = L.divIcon({
      className: 'dot',
      iconSize: [this.config.targetSize, this.config.targetSize],
    });
    let color = '#999999';
    let tooltipAltitude = '';
    let tooltipSpeed = '';
    this.sortAircraftByAltitude();
    this.aircraft.forEach((aircraft, index) => {
      if ('lat' in aircraft) {
        let target = new L.marker([aircraft.lat, aircraft.lon], {
          icon: targetDot,
          zIndexOffset: this.maxMMzIndex + index,
        });
        if (this.config.showIdBlock) {
          if ('alt_baro' in aircraft && this.config.useFade) {
            if (this.config.useAltitude) {
              tooltipAltitude = `<br/>${aircraft.alt_baro}`;
            }
            color = this.floatToGreyscale(aircraft.alt_baro, 100000);
          }
          if ('gs' in aircraft && this.config.useSpeed) {
            let breakSpace = this.config.useAltitude ? '&nbsp;' : '<br/>';
            tooltipSpeed = `${breakSpace}${Math.round(aircraft.gs)}`;
          }
          if ('flight' in aircraft) {
            target.bindTooltip(
              `<div style="color:${color};text-align:left">${aircraft.flight}${tooltipAltitude}${tooltipSpeed}</div>`,
              {
                pane: 'overlayPane',
                direction: 'right',
                permanent: true,
                opacity: 1.0,
              }
            );
          }
        }
        target.addTo(this.aircraftGroup);
      }
    });
  },
  drawMap() {
    this.isMapSet = true;
    let mapArea = document.getElementById('map');
    this.mapObject = L.map(mapArea, {
      attributionControl: false,
      zoomControl: false,
      doubleClickZoom: false,
      dragging: false,
      scrollWheelZoom: false,
    }).setView([this.config.lat, this.config.lon], 5);
    this.mapObject.createPane('underlayPane');
    this.mapObject.getPane('underlayPane').style.zIndex = -1000;
    this.aircraftGroup = L.featureGroup();
    this.ringsGroup = L.featureGroup();
    this.polylineGroup = L.featureGroup();
    this.polylineGroup.addTo(this.mapObject);
    this.ringsGroup.addTo(this.mapObject);
    this.aircraftGroup.addTo(this.mapObject);
    this.setLineFeatures();
    this.setRangeRings();
  },
  setRangeRings() {
    // Add Centerpoint
    if (this.config.showLocation) {
      let radius = this.nauticalMilesToMeters(0.5);
      new L.Circle([this.config.lat, this.config.lon], radius, {
        pane: 'underlayPane',
        color: '#FFFFFF',
        weight: 1,
        fillColor: '#FFFFFF',
        fillOpacity: 0.0,
      }).addTo(this.ringsGroup);
    }
    //Add Range Rings
    this.config.rangeRings.forEach((ring) => {
      let radius = this.nauticalMilesToMeters(ring);
      new L.Circle([this.config.lat, this.config.lon], radius, {
        pane: 'underlayPane',
        color: '#404040',
        weight: 1,
        fillColor: '#FFFFFF',
        fillOpacity: 0.0,
      }).addTo(this.ringsGroup);
    });
    this.mapObject.fitBounds(this.ringsGroup.getBounds());
    console.log(this.ringsGroup);
  },
  setLineFeatures() {
    if (this.config.lineFeatures !== null) {
      this.config.lineFeatures.forEach((feature) => {
        let start = feature.start;
        let end = feature.end;
        new L.polyline(
          [
            [start.lat, start.lon],
            [end.lat, end.lon],
          ],
          {
            pane: 'underlayPane',
            color: '#FFFFFF',
            weight: 1,
          }
        ).addTo(this.polylineGroup);
      });
    }
  },
  nauticalMilesToMeters(nauticalMiles) {
    return nauticalMiles * 1852;
  },
  decToHex(intVal) {
    return intVal.toString(16);
  },
  rgbToHex(rInt, bInt, gInt) {
    hexR = this.decToHex(rInt).padStart(2, 0);
    hexB = this.decToHex(bInt).padStart(2, 0);
    hexG = this.decToHex(gInt).padStart(2, 0);
    return `#${hexR}${hexB}${hexG}`;
  },
  floatToGreyscale(value, denominator = 100) {
    let colorInt = parseInt(255 * (value / denominator));
    return this.rgbToHex(colorInt, colorInt, colorInt);
  },
  sortAircraftByAltitude() {
    // Sort descending with priority given to those with altitude
    this.aircraft.sort((left, right) => {
      let leftHas = 'alt_baro' in left;
      let rightHas = 'alt_baro' in right;
      if (leftHas && rightHas) {
        return left.alt_baro - right.alt_baro;
      }
      return leftHas ? -1 : rightHas ? 1 : 0;
    });
  },
});
