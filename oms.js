  /** @preserve OverlappingMarkerSpiderfier
  https://github.com/jawj/OverlappingMarkerSpiderfier
  Copyright (c) 2011 - 2017 George MacKerron
  Released under the MIT licence: http://opensource.org/licenses/mit-license
  */
var callbackName, callbackRegEx, ref, ref1, scriptTag, tag,
  hasProp = {}.hasOwnProperty;

this['OverlappingMarkerSpiderfier'] = (function() {
  var _Class, ge, gm, j, len, mt, p, ref, twoPi, x;

  // NB. string literal properties -- object['key'] -- are for Closure Compiler ADVANCED_OPTIMIZATION
  _Class = class {
    // Note: it's OK that this constructor comes after the properties, because a function defined by a 
    // function declaration can be used before the function declaration itself
    constructor(map1, opts = {}) {
      var k, lcH, lcU, v;
      this.map = map1;
      // initialize prototype variables only on first construction, 
      // because some rely on GMaps properties that may not be available on script load
      if (this.constructor.hasInitialized == null) {
        this.constructor.hasInitialized = true;
        gm = google.maps;
        ge = gm.event;
        mt = gm.MapTypeId;
        p['keepSpiderfied'] = false; // yes -> don't unspiderfy when a spiderfied marker is selected
        p['ignoreMapClick'] = false; // yes -> don't unspiderfy when the map is clicked
        p['markersWontHide'] = false; // yes -> a promise you won't hide markers, so we needn't check
        p['markersWontMove'] = false; // yes -> a promise you won't move markers, so we needn't check
        p['basicFormatEvents'] = false; // yes -> save some computation by receiving only SPIDERFIED | UNSPIDERFIED format updates 
        // (not SPIDERFIED | SPIDERFIABLE | UNSPIDERFIABLE)
        p['nearbyDistance'] = 20; // spiderfy markers within this range of the one clicked, in px
        p['circleSpiralSwitchover'] = 9; // show spiral instead of circle from this marker count upwards
        // 0 -> always spiral; Infinity -> always circle
        p['circleFootSeparation'] = 23; // related to circumference of circle
        p['circleStartAngle'] = twoPi / 12;
        p['spiralFootSeparation'] = 26; // related to size of spiral (experiment!)
        p['spiralLengthStart'] = 11; // ditto
        p['spiralLengthFactor'] = 4; // ditto
        p['spiderfiedZIndex'] = gm.Marker.MAX_ZINDEX + 20000; // ensure spiderfied markers are on top
        p['highlightedLegZIndex'] = gm.Marker.MAX_ZINDEX + 10000; // ensure highlighted leg is always on top
        p['usualLegZIndex'] = gm.Marker.MAX_ZINDEX + 1; // for legs (doesn't work?)
        p['legWeight'] = 1.5;
        p['legColors'] = {
          'usual': {},
          'highlighted': {}
        };
        lcU = p['legColors']['usual'];
        lcH = p['legColors']['highlighted'];
        lcU[mt.HYBRID] = lcU[mt.SATELLITE] = '#fff';
        lcH[mt.HYBRID] = lcH[mt.SATELLITE] = '#f00';
        lcU[mt.TERRAIN] = lcU[mt.ROADMAP] = '#444';
        lcH[mt.TERRAIN] = lcH[mt.ROADMAP] = '#f00';
        // the ProjHelper object is just used to get the map's projection
        this.constructor.ProjHelper = function(map) {
          return this.setMap(map);
        };
        this.constructor.ProjHelper.prototype = new gm.OverlayView();
        this.constructor.ProjHelper.prototype['draw'] = function() {}; // dummy function
      }
      for (k in opts) {
        if (!hasProp.call(opts, k)) continue;
        v = opts[k];
        (this[k] = v);
      }
      this.projHelper = new this.constructor.ProjHelper(this.map);
      this.initMarkerArrays();
      this.listeners = {};
      this.formatIdleListener = this.formatTimeoutId = null;
      this.addListener('click', function(marker, e) {
        return ge.trigger(marker, 'spider_click', e); // new-style events, easier to integrate
      });
      this.addListener('format', function(marker, status) {
        return ge.trigger(marker, 'spider_format', status);
      });
      if (!this['ignoreMapClick']) {
        ge.addListener(this.map, 'click', () => {
          return this['unspiderfy']();
        });
      }
      ge.addListener(this.map, 'maptypeid_changed', () => {
        return this['unspiderfy']();
      });
      ge.addListener(this.map, 'zoom_changed', () => {
        this['unspiderfy']();
        if (!this['basicFormatEvents']) {
          return this.formatMarkers();
        }
      });
    }

  };

  p = _Class.prototype; // this saves a lot of repetition of .prototype that isn't optimized away

  ref = [_Class, p];
  // better on @, but defined on p too for backward-compat
  for (j = 0, len = ref.length; j < len; j++) {
    x = ref[j];
    x['VERSION'] = '1.0.3';
  }

  twoPi = Math.PI * 2;

  gm = ge = mt = null; // for scoping purposes

  _Class['markerStatus'] = {
    
    // universal status
    'SPIDERFIED': 'SPIDERFIED',
    // statuses reported under standard regine
    'SPIDERFIABLE': 'SPIDERFIABLE',
    'UNSPIDERFIABLE': 'UNSPIDERFIABLE',
    // status reported under simple status update regime only
    'UNSPIDERFIED': 'UNSPIDERFIED'
  };

  p.initMarkerArrays = function() {
    this.markers = [];
    return this.markerListenerRefs = [];
  };

  p.isVisibleMarker = function(m) {
    return m.map !== null && m.map.getBounds().contains(m.position);
  };

  p['addMarker'] = function(marker, spiderClickHandler) {
    marker.setMap(this.map);
    return this['trackMarker'](marker, spiderClickHandler);
  };

  p['trackMarker'] = function(marker, spiderClickHandler) {
    var listenerRefs;
    if (marker['_oms'] != null) {
      return this;
    }
    marker['_oms'] = true;
    // marker.setOptions optimized: no  # 'optimized' rendering is sometimes buggy, but seems mainly OK on current GMaps
    listenerRefs = [
      ge.addListener(marker,
      'click',
      (e) => {
        return this.spiderListener(marker,
      e);
      })
    ];
    if (!this['markersWontHide']) {
      listenerRefs.push(ge.addListener(marker, 'visible_changed', () => {
        return this.markerChangeListener(marker, false);
      }));
    }
    if (!this['markersWontMove']) {
      listenerRefs.push(ge.addListener(marker, 'position_changed', () => {
        return this.markerChangeListener(marker, true);
      }));
    }
    if (spiderClickHandler != null) {
      listenerRefs.push(ge.addListener(marker, 'spider_click', spiderClickHandler));
    }
    this.markerListenerRefs.push(listenerRefs);
    this.markers.push(marker);
    if (this['basicFormatEvents']) {
      this.trigger('format', marker, this.constructor['markerStatus']['UNSPIDERFIED']);
    } else {
      this.trigger('format', marker, this.constructor['markerStatus']['UNSPIDERFIABLE']);
      this.formatMarkers();
    }
    return this;
  };

  p.markerChangeListener = function(marker, positionChanged) {
    if (this.spiderfying || this.unspiderfying) {
      return;
    }
    if ((marker['_omsData'] != null) && (positionChanged || !this.isVisibleMarker(marker))) {
      this['unspiderfy'](positionChanged ? marker : null);
    }
    return this.formatMarkers();
  };

  p['getMarkers'] = function() {
    return this.markers.slice(0);
  };

  p['removeMarker'] = function(marker) {
    this['forgetMarker'](marker);
    return marker.setMap(null);
  };

  p['forgetMarker'] = function(marker) {
    var i, l, len1, listenerRef, listenerRefs;
    if (marker['_omsData'] != null) {
      this['unspiderfy']();
    }
    i = this.arrIndexOf(this.markers, marker);
    if (i < 0) {
      return this;
    }
    listenerRefs = this.markerListenerRefs.splice(i, 1)[0];
    for (l = 0, len1 = listenerRefs.length; l < len1; l++) {
      listenerRef = listenerRefs[l];
      ge.removeListener(listenerRef);
    }
    delete marker['_oms'];
    this.markers.splice(i, 1);
    this.formatMarkers();
    return this;
  };

  p['removeAllMarkers'] = p['clearMarkers'] = function() { // much quicker than calling removeMarker for each marker; clearMarkers is deprecated as unclear
    var l, len1, marker, markers;
    markers = this['getMarkers']();
    this['forgetAllMarkers']();
    for (l = 0, len1 = markers.length; l < len1; l++) {
      marker = markers[l];
      marker.setMap(null);
    }
    return this;
  };

  p['forgetAllMarkers'] = function() {
    var i, l, len1, len2, listenerRef, listenerRefs, marker, n, ref1;
    this['unspiderfy']();
    ref1 = this.markers;
    for (i = l = 0, len1 = ref1.length; l < len1; i = ++l) {
      marker = ref1[i];
      listenerRefs = this.markerListenerRefs[i];
      for (n = 0, len2 = listenerRefs.length; n < len2; n++) {
        listenerRef = listenerRefs[n];
        ge.removeListener(listenerRef);
      }
      delete marker['_oms'];
    }
    this.initMarkerArrays();
    return this;
  };

  
  // available listeners: click(marker), spiderfy(markers), unspiderfy(markers)
  p['addListener'] = function(eventName, func) {
    var base;
    ((base = this.listeners)[eventName] != null ? base[eventName] : base[eventName] = []).push(func);
    return this;
  };

  p['removeListener'] = function(eventName, func) {
    var i;
    i = this.arrIndexOf(this.listeners[eventName], func);
    if (!(i < 0)) {
      this.listeners[eventName].splice(i, 1);
    }
    return this;
  };

  p['clearListeners'] = function(eventName) {
    this.listeners[eventName] = [];
    return this;
  };

  p.trigger = function(eventName, ...args) {
    var func, l, len1, ref1, ref2, results;
    ref2 = (ref1 = this.listeners[eventName]) != null ? ref1 : [];
    results = [];
    for (l = 0, len1 = ref2.length; l < len1; l++) {
      func = ref2[l];
      results.push(func(...args));
    }
    return results;
  };

  p.generatePtsCircle = function(count, centerPt) {
    var angle, angleStep, circumference, i, l, legLength, ref1, results;
    circumference = this['circleFootSeparation'] * (2 + count);
    legLength = circumference / twoPi; // = radius from circumference
    angleStep = twoPi / count;
    results = [];
    for (i = l = 0, ref1 = count; (0 <= ref1 ? l < ref1 : l > ref1); i = 0 <= ref1 ? ++l : --l) {
      angle = this['circleStartAngle'] + i * angleStep;
      results.push(new gm.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle)));
    }
    return results;
  };

  p.generatePtsSpiral = function(count, centerPt) {
    var angle, i, l, legLength, pt, ref1, results;
    legLength = this['spiralLengthStart'];
    angle = 0;
    results = [];
    for (i = l = 0, ref1 = count; (0 <= ref1 ? l < ref1 : l > ref1); i = 0 <= ref1 ? ++l : --l) {
      angle += this['spiralFootSeparation'] / legLength + i * 0.0005;
      pt = new gm.Point(centerPt.x + legLength * Math.cos(angle), centerPt.y + legLength * Math.sin(angle));
      legLength += twoPi * this['spiralLengthFactor'] / angle;
      results.push(pt);
    }
    return results;
  };

  p.spiderListener = function(marker, e) {
    var l, len1, m, mPt, markerPt, markerSpiderfied, nDist, nearbyMarkerData, nonNearbyMarkers, pxSq, ref1;
    markerSpiderfied = marker['_omsData'] != null;
    if (!(markerSpiderfied && this['keepSpiderfied'])) {
      this['unspiderfy']();
    }
    if (markerSpiderfied || this.map.getStreetView().getVisible() || this.map.getMapTypeId() === 'GoogleEarthAPI') { // don't spiderfy in Street View or GE Plugin!
      return this.trigger('click', marker, e);
    } else {
      nearbyMarkerData = [];
      nonNearbyMarkers = [];
      nDist = this['nearbyDistance'];
      pxSq = nDist * nDist;
      markerPt = this.llToPt(marker.position);
      ref1 = this.markers;
      for (l = 0, len1 = ref1.length; l < len1; l++) {
        m = ref1[l];
        if (!((m.map != null) && this.isVisibleMarker(m))) { // at 2011-08-12, property m.visible is undefined in API v3.5
          continue;
        }
        mPt = this.llToPt(m.position);
        if (this.ptDistanceSq(mPt, markerPt) < pxSq) {
          nearbyMarkerData.push({
            marker: m,
            markerPt: mPt
          });
        } else {
          nonNearbyMarkers.push(m);
        }
      }
      if (nearbyMarkerData.length === 1) { // 1 => the one clicked => none nearby
        return this.trigger('click', marker, e);
      } else {
        return this.spiderfy(nearbyMarkerData, nonNearbyMarkers);
      }
    }
  };

  p['markersNearMarker'] = function(marker, firstOnly = false) {
    var l, len1, m, mPt, markerPt, markers, nDist, pxSq, ref1, ref2, ref3;
    if (this.projHelper.getProjection() == null) {
      throw "Must wait for 'idle' event on map before calling markersNearMarker";
    }
    nDist = this['nearbyDistance'];
    pxSq = nDist * nDist;
    markerPt = this.llToPt(marker.position);
    markers = [];
    ref1 = this.markers;
    for (l = 0, len1 = ref1.length; l < len1; l++) {
      m = ref1[l];
      if (m === marker || (m.map == null) || !this.isVisibleMarker(m)) {
        continue;
      }
      mPt = this.llToPt((ref2 = (ref3 = m['_omsData']) != null ? ref3.usualPosition : void 0) != null ? ref2 : m.position);
      if (this.ptDistanceSq(mPt, markerPt) < pxSq) {
        markers.push(m);
        if (firstOnly) {
          break;
        }
      }
    }
    return markers;
  };

  p.markerProximityData = function() {
    var i1, i2, l, len1, len2, m, m1, m1Data, m2, m2Data, mData, n, nDist, pxSq, ref1, ref2;
    if (this.projHelper.getProjection() == null) {
      throw "Must wait for 'idle' event on map before calling markersNearAnyOtherMarker";
    }
    nDist = this['nearbyDistance'];
    pxSq = nDist * nDist;
    mData = (function() {
      var l, len1, ref1, ref2, ref3, results;
      ref1 = this.markers;
      results = [];
      for (l = 0, len1 = ref1.length; l < len1; l++) {
        m = ref1[l];
        results.push({
          pt: this.llToPt((ref2 = (ref3 = m['_omsData']) != null ? ref3.usualPosition : void 0) != null ? ref2 : m.position),
          willSpiderfy: false
        });
      }
      return results;
    }).call(this);
    ref1 = this.markers;
    for (i1 = l = 0, len1 = ref1.length; l < len1; i1 = ++l) {
      m1 = ref1[i1];
      if (!((m1.map != null) && this.isVisibleMarker(m1))) { // marker not visible: ignore
        continue;
      }
      m1Data = mData[i1];
      if (m1Data.willSpiderfy) { // true in the case that we've assessed an earlier marker that was near this one
        continue;
      }
      ref2 = this.markers;
      for (i2 = n = 0, len2 = ref2.length; n < len2; i2 = ++n) {
        m2 = ref2[i2];
        if (i2 === i1) { // markers cannot be near themselves: ignore
          continue;
        }
        if (!((m2.map != null) && this.isVisibleMarker(m2))) { // marker not visible: ignore
          continue;
        }
        m2Data = mData[i2];
        if (i2 < i1 && !m2Data.willSpiderfy) { // if i2 < i1, m2 has already been checked for proximity to any other marker; 
          continue;
        }
        // so if willSpiderfy is false, it cannot be near any other marker, including this one (m1)
        if (this.ptDistanceSq(m1Data.pt, m2Data.pt) < pxSq) {
          m1Data.willSpiderfy = m2Data.willSpiderfy = true;
          break;
        }
      }
    }
    return mData;
  };

  p['markersNearAnyOtherMarker'] = function() { // *very* much quicker than calling markersNearMarker in a loop
    var i, l, len1, m, mData, ref1, results;
    mData = this.markerProximityData();
    ref1 = this.markers;
    results = [];
    for (i = l = 0, len1 = ref1.length; l < len1; i = ++l) {
      m = ref1[i];
      if (mData[i].willSpiderfy) {
        results.push(m);
      }
    }
    return results;
  };

  
  // 'format' (on OMS instance) and 'spider_format' (per marker) will be called:
  // * on spiderfy, for all markers that spiderfy (status: SPIDERFIED)
  // * on unspiderfy, for all markers that unspiderfy (status: SPIDERFIABLE — or UNSPIDERFIED, if opted out of advanced updates)
  // * on map zoom and on marker add, remove, position_changed, visible_changed, for all markers (status: SPIDERFIABLE | UNSPIDERFIABLE — or UNSPIDERFIED, if opted out of advanced updates)
  p.setImmediate = function(func) {
    return window.setTimeout(func, 0);
  };

  p.formatMarkers = function() {
    if (this['basicFormatEvents']) {
      return;
    }
    if (this.formatTimeoutId != null) {
      return; // only format markers once per run loop (in case e.g. being called repeatedly from addMarker)
    }
    return this.formatTimeoutId = this.setImmediate(() => {
      this.formatTimeoutId = null;
      if (this.projHelper.getProjection() != null) {
        return this._formatMarkers();
      } else {
        if (this.formatIdleListener != null) {
          return; // if the map is not yet ready, and we're not already waiting, wait until it is ready
        }
        return this.formatIdleListener = ge.addListenerOnce(this.map, 'idle', () => {
          return this._formatMarkers();
        });
      }
    });
  };

  p._formatMarkers = function() { // only formatMarkers is allowed to call this directly 
    var i, l, len1, len2, marker, n, proximities, ref1, results, results1, status;
    if (this['basicFormatEvents']) {
      results = [];
      for (l = 0, len1 = markers.length; l < len1; l++) {
        marker = markers[l];
        status = marker['_omsData'] != null ? 'SPIDERFIED' : 'UNSPIDERFIED';
        results.push(this.trigger('format', marker, this.constructor['markerStatus'][status]));
      }
      return results;
    } else {
      proximities = this.markerProximityData(); // {pt, willSpiderfy}[]
      ref1 = this.markers;
      results1 = [];
      for (i = n = 0, len2 = ref1.length; n < len2; i = ++n) {
        marker = ref1[i];
        status = marker['_omsData'] != null ? 'SPIDERFIED' : proximities[i].willSpiderfy ? 'SPIDERFIABLE' : 'UNSPIDERFIABLE';
        results1.push(this.trigger('format', marker, this.constructor['markerStatus'][status]));
      }
      return results1;
    }
  };

  p.makeHighlightListenerFuncs = function(marker) {
    return {
      highlight: () => {
        return marker['_omsData'].leg.setOptions({
          strokeColor: this['legColors']['highlighted'][this.map.mapTypeId],
          zIndex: this['highlightedLegZIndex']
        });
      },
      unhighlight: () => {
        return marker['_omsData'].leg.setOptions({
          strokeColor: this['legColors']['usual'][this.map.mapTypeId],
          zIndex: this['usualLegZIndex']
        });
      }
    };
  };

  p.spiderfy = function(markerData, nonNearbyMarkers) {
    var bodyPt, footLl, footPt, footPts, highlightListenerFuncs, leg, marker, md, nearestMarkerDatum, numFeet, spiderfiedMarkers;
    this.spiderfying = true;
    numFeet = markerData.length;
    bodyPt = this.ptAverage((function() {
      var l, len1, results;
      results = [];
      for (l = 0, len1 = markerData.length; l < len1; l++) {
        md = markerData[l];
        results.push(md.markerPt);
      }
      return results;
    })());
    footPts = numFeet >= this['circleSpiralSwitchover'] ? this.generatePtsSpiral(numFeet, bodyPt).reverse() : this.generatePtsCircle(numFeet, bodyPt); // match from outside in => less criss-crossing
    spiderfiedMarkers = (function() {
      var l, len1, results;
      results = [];
      for (l = 0, len1 = footPts.length; l < len1; l++) {
        footPt = footPts[l];
        footLl = this.ptToLl(footPt);
        nearestMarkerDatum = this.minExtract(markerData, (md) => {
          return this.ptDistanceSq(md.markerPt, footPt);
        });
        marker = nearestMarkerDatum.marker;
        leg = new gm.Polyline({
          map: this.map,
          path: [marker.position, footLl],
          strokeColor: this['legColors']['usual'][this.map.mapTypeId],
          strokeWeight: this['legWeight'],
          zIndex: this['usualLegZIndex']
        });
        marker['_omsData'] = {
          usualPosition: marker.position,
          usualZIndex: marker.zIndex,
          leg: leg
        };
        if (this['legColors']['highlighted'][this.map.mapTypeId] !== this['legColors']['usual'][this.map.mapTypeId]) {
          highlightListenerFuncs = this.makeHighlightListenerFuncs(marker);
          marker['_omsData'].hightlightListeners = {
            highlight: ge.addListener(marker, 'mouseover', highlightListenerFuncs.highlight),
            unhighlight: ge.addListener(marker, 'mouseout', highlightListenerFuncs.unhighlight)
          };
        }
        this.trigger('format', marker, this.constructor['markerStatus']['SPIDERFIED']);
        marker.position = footLl;
        marker.zIndex = Math.round(this['spiderfiedZIndex'] + footPt.y); // lower markers cover higher
        results.push(marker);
      }
      return results;
    }).call(this);
    delete this.spiderfying;
    this.spiderfied = true;
    return this.trigger('spiderfy', spiderfiedMarkers, nonNearbyMarkers);
  };

  p['unspiderfy'] = function(markerNotToMove = null) {
    var l, len1, listeners, marker, nonNearbyMarkers, ref1, status, unspiderfiedMarkers;
    if (this.spiderfied == null) {
      return this;
    }
    this.unspiderfying = true;
    unspiderfiedMarkers = [];
    nonNearbyMarkers = [];
    ref1 = this.markers;
    for (l = 0, len1 = ref1.length; l < len1; l++) {
      marker = ref1[l];
      if (marker['_omsData'] != null) {
        marker['_omsData'].leg.setMap(null);
        if (marker !== markerNotToMove) {
          marker.position = marker['_omsData'].usualPosition;
        }
        marker.zIndex = marker['_omsData'].usualZIndex;
        listeners = marker['_omsData'].hightlightListeners;
        if (listeners != null) {
          ge.removeListener(listeners.highlight);
          ge.removeListener(listeners.unhighlight);
        }
        delete marker['_omsData'];
        if (marker !== markerNotToMove) { // if marker is markerNotToMove, formatMarkers is about to be called anyway
          status = this['basicFormatEvents'] ? 'UNSPIDERFIED' : 'SPIDERFIABLE'; // unspiderfying? must be spiderfiable
          this.trigger('format', marker, this.constructor['markerStatus'][status]);
        }
        unspiderfiedMarkers.push(marker);
      } else {
        nonNearbyMarkers.push(marker);
      }
    }
    delete this.unspiderfying;
    delete this.spiderfied;
    this.trigger('unspiderfy', unspiderfiedMarkers, nonNearbyMarkers);
    return this;
  };

  p.ptDistanceSq = function(pt1, pt2) {
    var dx, dy;
    dx = pt1.x - pt2.x;
    dy = pt1.y - pt2.y;
    return dx * dx + dy * dy;
  };

  p.ptAverage = function(pts) {
    var l, len1, numPts, pt, sumX, sumY;
    sumX = sumY = 0;
    for (l = 0, len1 = pts.length; l < len1; l++) {
      pt = pts[l];
      sumX += pt.x;
      sumY += pt.y;
    }
    numPts = pts.length;
    return new gm.Point(sumX / numPts, sumY / numPts);
  };

  p.llToPt = function(ll) {
    return this.projHelper.getProjection().fromLatLngToDivPixel(ll);
  };

  p.ptToLl = function(pt) {
    return this.projHelper.getProjection().fromDivPixelToLatLng(pt);
  };

  p.minExtract = function(set, func) { // destructive! returns minimum, and also removes it from the set
    var bestIndex, bestVal, index, item, l, len1, val;
    for (index = l = 0, len1 = set.length; l < len1; index = ++l) {
      item = set[index];
      val = func(item);
      if ((typeof bestIndex === "undefined" || bestIndex === null) || val < bestVal) {
        bestVal = val;
        bestIndex = index;
      }
    }
    return set.splice(bestIndex, 1)[0];
  };

  p.arrIndexOf = function(arr, obj) {
    if (arr.indexOf != null) {
      return arr.indexOf(obj);
    }
    //    (return i if o is obj) for o, i in arr
    return -1;
  };

  return _Class;

}).call(this);

// callbacks for async loading

// callback specified in script src (e.g. <script src="oms.js?spiderfier_callback=myCallback">), like GMaps itself uses
callbackRegEx = /(\?.*(&|&amp;)|\?)spiderfier_callback=(\w+)/;

scriptTag = document.currentScript;

if (scriptTag == null) {
  scriptTag = ((function() {
    var j, len, ref, ref1, results;
    ref = document.getElementsByTagName('script');
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      tag = ref[j];
      if ((ref1 = tag.getAttribute('src')) != null ? ref1.match(callbackRegEx) : void 0) {
        results.push(tag);
      }
    }
    return results;
  })())[0];
}

if (scriptTag != null) {
  callbackName = (ref = scriptTag.getAttribute('src')) != null ? (ref1 = ref.match(callbackRegEx)) != null ? ref1[3] : void 0 : void 0;
  if (callbackName) {
    if (typeof window[callbackName] === "function") {
      window[callbackName]();
    }
  }
}

if (typeof window['spiderfier_callback'] === "function") {
  window['spiderfier_callback']();
}
