import { Component, OnInit } from '@angular/core';

import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import OSM from 'ol/source/OSM';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import LineString from 'ol/geom/LineString';
import CircleStyle from 'ol/style/Circle';
import { Style, Stroke, Fill, Text } from 'ol/style';
import { getVectorContext } from 'ol/render';

import { DataService, Vessel } from '../shared/data.service';
import Overlay from 'ol/Overlay';

declare var $: any;

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit {

  // viariables initialization
  loading = false;
  data: any[] = [];
  map: Map;
  vectorLayer: VectorLayer<any>;
  vectorSource: VectorSource<Point>;
  clustersLayer: VectorLayer<any>;
  clustersSource: Cluster;
  lineLayer: VectorLayer<any>;
  lineSource: VectorSource<LineString>;
  starterPoint: Feature<any>;
  pointIndex: 0;
  animating = false;
  starterPointStyle = new Style({
    image: new CircleStyle({
      radius: 7,
      fill: new Fill({color: 'blue'}),
      stroke: new Stroke({
        color: 'white',
        width: 2
      })
    })
  });
  line;
  position;
  distance = 0;
  clusters: VectorSource<Point>;
  styleCache = {};
  waypoints = []
  constructor(private dataService: DataService) { }

  ngOnInit() {
    //setting up layers and sources

    this.lineSource = new VectorSource({
      features: [],
    });

    this.vectorSource = new VectorSource({
      features: []
    });
    this.clusters = new VectorSource({
      features: []
    });
    this.clustersSource = new Cluster({
      distance: 40,
      minDistance: 20,
      source: this.clusters
    });
    const parent = this;
    function clusterStyle(feature) {
      const size = feature.get('features').length;
      let style = parent.styleCache[size];
      if (!style) {
        style = new Style({
          image: new CircleStyle({
            radius: 10 + size / 4,
            stroke: new Stroke({
              color: '#fff',
            }),
            fill: new Fill({
              color: '#3399CC',
            }),
          }),
          text: new Text({
            text: size > 1 ? size.toString() : '',
            fill: new Fill({
              color: '#fff',
            }),
          }),
        });
        parent.styleCache[size] = style;
      }
      return style;
      }
    this.vectorLayer = new VectorLayer({
      source: this.vectorSource
    });
    this.clustersLayer = new VectorLayer({
      source: this.clustersSource,
      style: clusterStyle
    });
    this.lineLayer = new VectorLayer({
      source: this.lineSource,
      style: new Style({
        stroke: new Stroke({
          color: 'red',
          width: 3,
          lineDash: [10, 10]
        })
      })
    });

    // set up map
    this.map = new Map({
      view: new View({
        center: [0, 0],
        zoom: 1
      }),
      layers: [
        new TileLayer({
          source: new OSM()
        }),
        this.lineLayer,
        this.clustersLayer,
        this.vectorLayer,
      ],
      target: 'map'
    });

    // set up popup container
    const container = document.getElementById('popup');
    const content = document.getElementById('popup-content');
    const closer = document.getElementById('popup-closer');
    const popup = new Overlay({
      element: container,
      autoPan: true,
      autoPanAnimation: {
        duration: 250,
      },
    });

    closer.onclick = function() {
      popup.setPosition(undefined);
      closer.blur();
      return false;
    };

    this.map.addOverlay(popup);

    // set up click listener
    this.map.on('singleclick', event => {
      const clickPoint = this.map.forEachFeatureAtPixel(event.pixel, feature => feature);
      if (clickPoint ) {
        const size = clickPoint.get('features')?.length;
        if (size && size === 1) {
          content.innerHTML = this.createTable(clickPoint.get('features')[0].get('details'));
          popup.setPosition(event.coordinate);
         }
      }
    });
  }

  getData() {
    this.waypoints = [];
    this.loading = true;
    this.vectorSource.clear();
    this.lineSource.clear();
    this.dataService.getData().subscribe(
      results => this.addFeatures(results)
    );
  }

  private addFeatures(features: Vessel[]) {
    features.forEach(feature => {
      const point = new Feature({
        geometry: new Point(fromLonLat([feature.LON, feature.LAT]))
      });
      point.set('details', feature);
      this.waypoints.push(fromLonLat([feature.LON, feature.LAT]));
      this.clusters.addFeature(point);
    });

    // create a line that connects all points.
    this.line = new LineString(this.waypoints);
    const vesselLine = new Feature({
      geometry: this.line
    });
    this.lineSource.addFeature(vesselLine);

    // add a starter point for the animation
    this.starterPoint = new Feature({
      geometry: new Point(this.waypoints[0]),
      style: this.starterPointStyle
    });
    this.position = new Point(this.waypoints[0]);
    this.vectorSource.addFeature(this.starterPoint);
    this.zoomToFit();
  }

  private zoomToFit(){
    const extent = this.clustersSource.getExtent();
    this.map.getView().fit(extent, {
      size: this.map.getSize(),
      padding: [100, 100, 100, 100],
      duration: (30 - this.map.getView().getZoom()) * 50
    });
    this.loading = false;
  }

  animate(){
    let lastTime;
    const parent = this;
    function updatePosition(event){
      const speed = 60;
      const time = event.frameState.time;
      const elapsedTime = time - lastTime;
      parent.distance = parent.animating ? (parent.distance + (speed * elapsedTime) / 1e6) % 2 : parent.distance;
      lastTime = time;
      const currentCoordinate = parent.line.getCoordinateAt(
        parent.distance > 1 ? 2 - parent.distance : parent.distance
      );
      parent.position.setCoordinates(currentCoordinate);
      const vectorContext = getVectorContext(event);
      vectorContext.setStyle(parent.starterPointStyle);
      vectorContext.drawGeometry(parent.position);
      // tell OpenLayers to continue the postrender animation
      parent.map.render();
    }
    if (!this.animating){
      lastTime = Date.now();
      this.clustersLayer.on('postrender', updatePosition);
      this.starterPoint.setGeometry(null);
    } else {
      this.starterPoint.setGeometry(this.position);
      this.clustersLayer.un('postrender', updatePosition);
    }
    this.animating = !this.animating;
  }

  private createTable(details: Record<string, number>): string {
    let table = '<table>';
    Object.entries(details).forEach(
      ([key, value]) => table += `<tr><td>${key}</td><td>${value}</td></tr>`
    );
    table += '</table>';
    return table;
  }

}

