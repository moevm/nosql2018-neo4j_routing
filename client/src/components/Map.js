import React, { Component } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = 'pk.eyJ1Ijoic2lnbjUiLCJhIjoiY2pxanJ5dzRhMDV1bzQ5cW51cXpuNGRobCJ9.GkSXyZbaKBJfpBhrAmIGjA';

class Map extends Component {
  constructor(props) {
    super(props);
    this.state = {
      lng: props.mapCenter.longitude,
      lat: props.mapCenter.latitude,
      zoom: props.mapCenter.zoom
    };

    this.businessMarkers = [];
    this.mapLoaded = false;

    this.geojson = {
      type: "FeatureCollection",
      features: []
    };

    this.routeGeojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: []
          }
        }
      ]
    };

    this.startGeojson = {
      type: "FeatureCollection",
      features: []
    };

    this.endGeojson = {
      type: "FeatureCollection",
      features: []
    };

    this.selectingStart = true;
    this.startAddress = this.props.startAddress;
    this.endAddress = this.props.endAddress;
  }

  // https://stackoverflow.com/questions/37599561/drawing-a-circle-with-the-radius-in-miles-meters-with-mapbox-gl-js
  createGeoJSONCircle = (center, radiusInKm, points) => {
    if (!points) points = 64;

    let coords = {
      latitude: center[1],
      longitude: center[0]
    };

    let km = radiusInKm;
    let ret = [];
    let distanceX = km / (111.32 * Math.cos((coords.latitude * Math.PI) / 180));
    let distanceY = km / 110.574;

    let theta, x, y;
    for (let i = 0; i < points; i++) {
      theta = (i / points) * (2 * Math.PI);
      x = distanceX * Math.cos(theta);
      y = distanceY * Math.sin(theta);
      ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]);

    return {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [ret]
            }
          }
        ]
      }
    };
  };

  geoJSONForPoints = points => {
    return points.map(point => {
      const p = point.properties;
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [p.lon, p.lat]
        },
        properties: {
          title: "",
          id: p.node_osm_id.toString(),
          name: p.name,
          icon: "monument",
          "marker-color": "#fc4353"
        }
      };
    });
  };

  setStartMarker() {
    const { startMarker } = this.props;

    if (startMarker) {
      new mapboxgl.Marker({ color: "yellow", zIndexOffset: 10 })
        .setLngLat([startMarker.longitude, startMarker.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(startMarker.address)
        )
        .addTo(this.map);
    }
  }

  setBusinessMarkers() {
    const { businesses } = this.props;
    this.geojson.features = this.geoJSONForPoints(businesses);
    this.map.getSource("geojson").setData(this.geojson);
  }

  fetchRoute() {
    if (this.startPOI && this.endPOI) {
      this.fetchRouteFor(this.startPOI, this.endPOI);
    }
  }

  fetchRouteFor(startPOI, endPOI) {
    const session = this.props.driver.session();

    let query;
    let distanceQuery;

    if (this.props.routeMode === "shortestpath") {
      query = `
      MATCH (a {node_osm_id: toInteger($startPOI)})
      MATCH (b {node_osm_id: toInteger($endPOI)})
      MATCH p=shortestPath((a)-[:PATH*..200]-(b))
      UNWIND nodes(p) AS n
      RETURN COLLECT([n.lon, n.lat]) AS route
    `;
      distanceQuery = `
      MATCH (a {node_osm_id: toInteger($startPOI)})
      MATCH (b {node_osm_id: toInteger($endPOI)})
      MATCH p=shortestPath((a)-[:PATH*..200]-(b))
      UNWIND rels(p) AS n
      RETURN sum(n.length) AS distance
    `;

    } else if (this.props.routeMode === "dijkstra") {
      query = `
      MATCH (a {node_osm_id: toInteger($startPOI)})
      MATCH (b {node_osm_id: toInteger($endPOI)})
      CALL apoc.algo.dijkstra(a,b,'PATH','length') YIELD path, weight
      UNWIND nodes(path) AS n
      RETURN COLLECT([n.lon, n.lat]) AS route
      `;
      distanceQuery = `
      MATCH (a {node_osm_id: toInteger($startPOI)})
      MATCH (b {node_osm_id: toInteger($endPOI)})
      CALL apoc.algo.dijkstra(a,b,'PATH','length') YIELD path, weight
      RETURN sum(weight) AS distance
      `;
    }

    console.log("Map: fetchRouteFor");
    session
      .run(query, {
        startPOI: startPOI,
        endPOI: endPOI,
        routeRadius: this.routeRadius
      })
      .then(result => {
        this.routeGeojson.features[0].geometry.coordinates = result.records[0].get("route");
        this.map.getSource("routeGeojson").setData(this.routeGeojson);
      })
      .catch(error => {
        console.log(error);
      })
      .finally(() => {
        session.close();
      });

    session
      .run(distanceQuery, {
        startPOI: startPOI,
        endPOI: endPOI
      })
      .then(result => {
        let distance = result.records[0].get("distance");
        this.props.setDistance(distance);
      })
      .catch(e => {
        console.log(e);
      })
      .finally(() => {
        session.close();
      });
  }

  componentDidUpdate() {
    this.setStartMarker();

    if (this.mapLoaded) {
      this.map
        .getSource("polygon")
        .setData(
          this.createGeoJSONCircle(
            [this.props.mapCenter.longitude, this.props.mapCenter.latitude],
            this.props.mapCenter.radius
          ).data
        );
      this.setBusinessMarkers();
    }
  }

  componentDidMount() {
    const { lng, lat, zoom } = this.state;

    this.map = new mapboxgl.Map({
      container: this.mapContainer,
      style: "mapbox://styles/mapbox/streets-v9",
      center: [lng, lat],
      zoom
    });

    this.map.on("load", () => {
      this.mapLoaded = true;
      this.map.addSource(
        "polygon",
        this.createGeoJSONCircle([lng, lat], this.props.mapCenter.radius)
      );
      this.map.addLayer({
        id: "polygon",
        type: "fill",
        source: "polygon",
        layout: {},
        paint: {
          "fill-color": "blue",
          "fill-opacity": 0.6
        }
      });

      this.map.addSource("geojson", {
        type: "geojson",
        data: this.geojson
      });

      this.map.addSource("routeGeojson", {
        type: "geojson",
        data: this.routeGeojson
      });

      this.map.addSource("startGeojson", {
        type: "geojson",
        data: this.startGeojson
      });

      this.map.addSource("endGeojson", {
        type: "geojson",
        data: this.endGeojson
      });

      this.map.addLayer({
        id: "start",
        type: "circle",
        source: "startGeojson",
        paint: {
          "circle-radius": 12,
          "circle-color": "green"
        }
      });

      this.map.addLayer({
        id: "end",
        type: "circle",
        source: "endGeojson",
        paint: {
          "circle-radius": 12,
          "circle-color": "red"
        }
      });

      this.map.addLayer({
        id: "points",
        type: "circle",
        source: "geojson",
        paint: {
          "circle-radius": 5,
          "circle-color": "#000",
        },
        filter: ["in", "$type", "Point"]
      });

      this.map.addLayer({
        id: "lines",
        type: "line",
        source: "routeGeojson",
        layout: {
          "line-cap": "round",
          "line-join": "round"
        },
        paint: {
          "line-color": "purple",
          "line-width": 10
        },
        filter: ["in", "$type", "LineString"]
      });

      this.map.on("mousemove", e => {
        var features = this.map.queryRenderedFeatures(e.point, {
          layers: ["points"]
        });
        // UI indicator for clicking/hovering a point on the map
        this.map.getCanvas().style.cursor = features.length ? "pointer" : "crosshair";
      });

      this.map.on("click", "points", e => {
        const feature = e.features[0];
        const name = feature.properties.name;
        const coordinates = feature.geometry.coordinates;

        if (this.selectingStart) {
          this.startPOI = feature.properties.id;
          this.selectingStart = false;
          this.routeGeojson.features[0].geometry.coordinates = [];
          this.startGeojson.features = [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: coordinates
              },
              properties: {
                title: "Start",
                name: name,
                id: name,
                icon: "monument",
                "marker-color": "#170"
              }
            }
          ];
          this.map.getSource("startGeojson").setData(this.startGeojson);
          this.map.getSource("routeGeojson").setData(this.routeGeojson);
          this.props.setStartAddress(feature.properties.id);
          this.fetchRoute();
        } else {
          this.endAddress = name;
          this.endPOI = feature.properties.id;
          this.endGeojson.features = [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: coordinates
              },
              properties: {
                title: "End",
                name: name,
                id: name,
                icon: "monument",
                "marker-color": "#F51"
              }
            }
          ];

          this.selectingStart = true;
          this.map.getSource("endGeojson").setData(this.endGeojson);
          this.props.setEndAddress(feature.properties.id);
          this.fetchRoute();
        }
      });
    });

    const onDragEnd = e => {
      var lngLat = e.target.getLngLat();

      const viewport = {
        latitude: lngLat.lat,
        longitude: lngLat.lng,
        zoom: this.map.getZoom()
      };
      this.routeRadius = this.props.mapCenter.radius * 1000;
      this.props.mapSearchPointChange(viewport);
    };

    new mapboxgl.Marker({ color: "red", zIndexOffset: 0 })
      .setLngLat([lng, lat])
      .addTo(this.map)
      .setDraggable(true)
      .on("dragend", onDragEnd)
      .addTo(this.map)
      .togglePopup();

    this.map.on("move", () => {
      const { lng, lat } = this.map.getCenter();

      this.setState({
        lng: lng,
        lat: lat,
        zoom: this.map.getZoom().toFixed(2)
      });
    });
  }

  render() {
    return (
      <div>
        <div
          ref={el => (this.mapContainer = el)}
          className="absolute top right left bottom"
        />
        <div id="distance" className="distance-container"/>
      </div>
    );
  }
}

export default Map;
