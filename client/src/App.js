import React, { Component } from "react";
import "./App.css";
import Map from "./components/Map";
import neo4j from "neo4j-driver/lib/browser/neo4j-web";
import axios from 'axios';

class App extends Component {
  constructor(props) {
    super(props);
    let focusedInput = null;

    this.state = {
      focusedInput,
      businesses: [],
      selectedBusiness: false,
      startPoint: 0,
      endPoint: 0,
      distance: 0,
      mapCenter: {
        latitude: 42.53032,
        longitude: 1.52027,
        radius: 0.05,
        zoom: 16
      },
      startAddress: "",
      endAddress: "",
      points: [],
      routeMode: "shortestpath"
    };
    this.driver = neo4j.driver(
      "bolt://localhost:7687", neo4j.auth.basic("neo4j", "toor"),
      { encrypted: false }
    );
    this.fetchBusinesses();
  }

  handleUpload = (e) => {
    e.preventDefault();
    this.setState({ selectedFile: e.target.files[0] });

    const selectedFile = e.target.files[0];
    let formData = new FormData();

    formData.append('selectedFile', selectedFile);

    axios.post('http://localhost:5000/import-map', formData)
      .then((result) => {
        console.log(result)
        // access results..
      });
  };

  setStartAddress = startAddress => {
    this.setState({
      startAddress
    });
  };

  setEndAddress = endAddress => {
    this.setState({
      endAddress
    });
  };

  handleRouteChange = event => {
    const target = event.target;
    const value = target.value;
    this.setState(
      {
        routeMode: value
      },
      () => console.log(this.state.routeMode)
    );
  };

  setDistance = distance => {
    this.setState({
      distance
    });
  };

  mapSearchPointChange = viewport => {
    this.setState({
      mapCenter: {
        ...this.state.mapCenter,
        latitude: viewport.latitude,
        longitude: viewport.longitude,
        zoom: viewport.zoom
      }
    });
  };

  fetchStartMarker = () => {
    const session = this.driver.session();

    const { mapCenter } = this.state;

    let query = `MATCH ()-[:PATH]->(a)
            WHERE distance(point({latitude: a.lat, longitude: a.lon}), point({latitude: $lat, longitude: $lon})) < (toFloat($radius) * 1000)
            RETURN a as node, distance(point({latitude: a.lat, longitude: a.lon}), point({latitude: $lat, longitude: $lon})) AS dist
            ORDER BY dist`;
    console.log(query);
    console.log("fetchStartMarker");
    session
      .run(query, {
        lat: mapCenter.latitude,
        lon: mapCenter.longitude,
        radius: mapCenter.radius
      })
      .then(result => {
        console.log(result);
        const record = result.records[0];

        this.setState({
          startMarker: {
            latitude: record.get("latitude"),
            longitude: record.get("longitude"),
            address: record.get("address")
          }
        })
      })
      .catch(e => {
        console.log(e);
      })
      .finally(
        session.close()
      );
  };

  fetchBusinesses = () => {
    const { mapCenter } = this.state;
    const session = this.driver.session();

    let query = `MATCH ()-[:PATH]->(a)
            WHERE distance(point({latitude: a.lat, longitude: a.lon}), point({latitude: $lat, longitude: $lon})) < ($radius * 1000)
            RETURN a as node, distance(point({latitude: a.lat, longitude: a.lon}), point({latitude: $lat, longitude: $lon})) AS dist
            ORDER BY dist`;
    session
      .run(query, {
        lat: mapCenter.latitude,
        lon: mapCenter.longitude,
        radius: mapCenter.radius
      })
      .then(result => {
        const points = result.records.map(r => r.get("node"));
        this.setState({ points });
        session.close();
      })
      .catch(e => {
        console.log(e);
        session.close();
      });
  };

  componentDidUpdate = (prevProps, prevState) => {
    if (this.state.mapCenter.latitude !== prevState.mapCenter.latitude ||
      this.state.mapCenter.longitude !== prevState.mapCenter.longitude) {
      this.fetchBusinesses();
    }
    if (this.state.selectedBusiness &&
      (!prevState.selectedBusiness || this.state.selectedBusiness.id !== prevState.selectedBusiness.id || false)) {
    }
  };

  handleSubmit = () => {
  };

  radiusChange = e => {
    this.setState(
      {
        mapCenter: {
          ...this.state.mapCenter,
          radius: Number(e.target.value)
        }
      },
      () => {
        this.fetchBusinesses();
      }
    );
  };

  render() {
    return (
      <div id="app-wrapper">
        <div id="app-toolbar">
          <form action="" onSubmit={this.handleSubmit}>
            <div className="row tools">
              <div className="col-sm-2">
                <div className="tool radius">
                  <h5>Query Radius</h5>
                  <input
                    type="number"
                    id="radius-value"
                    className="form-control"
                    min="0.01"
                    max="1.0"
                    step="0.01"
                    value={this.state.mapCenter.radius}
                    onChange={this.radiusChange}
                  />
                  <h5 id="radius-value">km</h5>
                </div>
              </div>

              <div className="col-sm-2">
                <div className="tool coordinates">
                  <h5>Latitude</h5>
                  <input
                    type="text" readonly
                    step="any"
                    id="coordinates-lat"
                    className="form-control"
                    placeholder="Latitude"
                    value={this.state.mapCenter.latitude}
                    onChange={() => true}
                  />
                </div>
              </div>

              <div className="col-sm-2">
                <div className="tool coordinates">
                  <h5>Longitude</h5>
                  <input
                    type="text" readonly
                    step="any"
                    id="coordinates-lng"
                    className="form-control"
                    placeholder="Longitude"
                    value={this.state.mapCenter.longitude}
                    onChange={() => true}
                  />
                </div>
              </div>

              <div className="col-sm-2">
                <div className="tool timeframe">
                  <h5>Start point ID</h5>
                  <input
                    type="text" readonly
                    id="address-start"
                    className="form-control"
                    placeholder="Start point ID"
                    value={this.state.startAddress}
                    onChange={() => true}
                  />
                </div>
              </div>

              <div className="col-sm-2">
                <div className="tool timeframe">
                  <h5>End point ID</h5>
                  <input
                    type="text" readonly
                    id="address-end"
                    className="form-control"
                    placeholder="End point ID"
                    value={this.state.endAddress}
                    onChange={() => true}
                  />
                </div>
              </div>

              <div className="col-sm-2">
                <div className="tool timeframe">
                  <h5>Route distance</h5>
                  <input
                    type="text"
                    id="route-distance"
                    className="form-control"
                    placeholder="Route length"
                    value={this.state.distance}
                    onChange={() => true}
                  />
                </div>
              </div>

              <div className="col-sm-2">
                <div className="tool"/>
              </div>
            </div>
            <div className="row">
              <div className="col-sm-4"/>
              <div className="col-sm-4"/>
            </div>
          </form>
        </div>

        <div id="app-left-side-panel">
          <h2>Route Algorithm</h2>
          <div className="row">
            <fieldset>
              <div>
                <input
                  type="radio"
                  id="shortestpath"
                  name="shortestpath"
                  value="shortestpath"
                  checked={this.state.routeMode === "shortestpath"}
                  onChange={this.handleRouteChange}
                />
                <label>Shortest Path</label>
              </div>
              <div>
                <input
                  type="radio"
                  id="dijkstra"
                  name="dijkstra"
                  value="dijkstra"
                  checked={this.state.routeMode === "dijkstra"}
                  onChange={this.handleRouteChange}
                />
                <label>Dijkstra</label>
              </div>
            </fieldset>
          </div>
        </div>

        <div id="app-left-side-import-panel">
          <h2>Data Import</h2>
          <div className="row">
              <div>
                <form encType="multipart/form-data" onSubmit={(e)=>{e.preventDefault(); this.handleUpload(e)}}>
                  <label htmlFor="file-upload" className="custom-file-upload">
                    <i className="fa fa-cloud-upload"></i> Import OSM
                  </label>
                  <input id="file-upload" type="file" onChange={this.handleUpload} />

                  {/*<input className="fileInput"*/}
                         {/*type="file"*/}
                         {/*onChange={this.handleFileChange} />*/}
                  {/*<button className="submitButton"*/}
                          {/*type="submit"*/}
                          {/*onClick={(e)=>{e.preventDefault(); this.handleUpload(e)}}>Import OSM</button>*/}
                </form>
              </div>
          </div>
        </div>

        <div>
          <div id="app-maparea">
            <Map
              mapSearchPointChange={this.mapSearchPointChange}
              mapCenter={this.state.mapCenter}
              businesses={this.state.points}
              selectedBusiness={this.state.selectedBusiness}
              startMarker={this.state.startMarker}
              setStartAddress={this.setStartAddress}
              setEndAddress={this.setEndAddress}
              setDistance={this.setDistance}
              driver={this.driver}
              routeMode={this.state.routeMode}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default App;
