/**
 * IWXXM 演示页内嵌样例（兜底层② + 双形态对照区数据）：wmo-im/iwxxm-translation 官方等价对
 * （Amd79-80-2023，IWXXM 2023-1）静态样例，与 corpus/iwxxm/metar-pairs 同源、裁剪 uuid/站名等
 * 惰性部分；两通道 IR 等价由 iwxxm-demo.test.ts 机器断言。独立成模块供主流程与测试共用。
 */

/** 对照区选站：官方等价对内嵌样例（覆盖 MPS 风+四条 RVR+趋势组 / CAVOK+阵风+跑道状态 / NOSIG+跑道状态缺位形态）。 */
export const COMPARE_STATIONS = ["ZSPD", "EKCH", "EETN"] as const;

/** 兜底层② + 对照区数据：源码内嵌 2023-1 官方等价对（与 corpus 同源、裁剪 uuid/站名等惰性部分；
 *  两通道 IR 等价由 iwxxm-demo.test.ts 机器断言）。 */
export const EMBEDDED: readonly {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  tac: string;
  xml: string;
}[] = [
  {
    icao: "ZSPD",
    name: "SHANGHAI PUDONG INTERNATIONAL AIRPORT",
    lat: 31.1434,
    lon: 121.805,
    tac: "METAR ZSPD 290000Z 13003MPS 0800 R17L/P2000 R16R/0600N R17R/1600U R16L/0900U FG BKN002 13/13 Q1018 BECMG TL0130 3000 BR SCT004 BKN020",
    xml: `<?xml version="1.0"?>
<iwxxm:METAR xmlns:iwxxm="http://icao.int/iwxxm/2023-1" reportStatus="NORMAL" automatedStation="false" permissibleUsage="OPERATIONAL">
  <iwxxm:issueTime><gml:TimeInstant xmlns:gml="http://www.opengis.net/gml/3.2" gml:id="t1"><gml:timePosition>2023-05-29T00:00:00Z</gml:timePosition></gml:TimeInstant></iwxxm:issueTime>
  <iwxxm:aerodrome><aixm:AirportHeliport xmlns:aixm="http://www.aixm.aero/schema/5.1.1"><aixm:timeSlice><aixm:AirportHeliportTimeSlice><aixm:locationIndicatorICAO>ZSPD</aixm:locationIndicatorICAO></aixm:AirportHeliportTimeSlice></aixm:timeSlice></aixm:AirportHeliport></iwxxm:aerodrome>
  <iwxxm:observationTime xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#t1"/>
  <iwxxm:observation>
    <iwxxm:MeteorologicalAerodromeObservation cloudAndVisibilityOK="false">
      <iwxxm:airTemperature uom="Cel">13</iwxxm:airTemperature>
      <iwxxm:dewpointTemperature uom="Cel">13</iwxxm:dewpointTemperature>
      <iwxxm:qnh uom="hPa">1018</iwxxm:qnh>
      <iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWind variableWindDirection="false"><iwxxm:meanWindDirection uom="deg">130</iwxxm:meanWindDirection><iwxxm:meanWindSpeed uom="m/s">3</iwxxm:meanWindSpeed></iwxxm:AerodromeSurfaceWind></iwxxm:surfaceWind>
      <iwxxm:visibility><iwxxm:AerodromeHorizontalVisibility><iwxxm:prevailingVisibility uom="m">800</iwxxm:prevailingVisibility></iwxxm:AerodromeHorizontalVisibility></iwxxm:visibility>
      <iwxxm:rvr><iwxxm:AerodromeRunwayVisualRange pastTendency="MISSING_VALUE"><iwxxm:runway><aixm:RunwayDirection><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>17L</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:meanRVR uom="m">2000</iwxxm:meanRVR><iwxxm:meanRVROperator>ABOVE</iwxxm:meanRVROperator></iwxxm:AerodromeRunwayVisualRange></iwxxm:rvr>
      <iwxxm:rvr><iwxxm:AerodromeRunwayVisualRange pastTendency="NO_CHANGE"><iwxxm:runway><aixm:RunwayDirection><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>16R</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:meanRVR uom="m">600</iwxxm:meanRVR></iwxxm:AerodromeRunwayVisualRange></iwxxm:rvr>
      <iwxxm:rvr><iwxxm:AerodromeRunwayVisualRange pastTendency="UPWARD"><iwxxm:runway><aixm:RunwayDirection><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>17R</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:meanRVR uom="m">1600</iwxxm:meanRVR></iwxxm:AerodromeRunwayVisualRange></iwxxm:rvr>
      <iwxxm:rvr><iwxxm:AerodromeRunwayVisualRange pastTendency="UPWARD"><iwxxm:runway><aixm:RunwayDirection><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>16L</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:meanRVR uom="m">900</iwxxm:meanRVR></iwxxm:AerodromeRunwayVisualRange></iwxxm:rvr>
      <iwxxm:presentWeather xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/306/4678/FG"/>
      <iwxxm:cloud><iwxxm:AerodromeCloud><iwxxm:layer><iwxxm:CloudLayer><iwxxm:amount xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/BKN"/><iwxxm:base uom="[ft_i]">200</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer></iwxxm:AerodromeCloud></iwxxm:cloud>
    </iwxxm:MeteorologicalAerodromeObservation>
  </iwxxm:observation>
  <iwxxm:trendForecast>
    <iwxxm:MeteorologicalAerodromeTrendForecast changeIndicator="BECOMING" cloudAndVisibilityOK="false">
      <iwxxm:phenomenonTime><gml:TimePeriod xmlns:gml="http://www.opengis.net/gml/3.2"><gml:beginPosition indeterminatePosition="after">2023-05-29T00:00:00Z</gml:beginPosition><gml:endPosition>2023-05-29T01:30:00Z</gml:endPosition></gml:TimePeriod></iwxxm:phenomenonTime>
      <iwxxm:timeIndicator>UNTIL</iwxxm:timeIndicator>
      <iwxxm:prevailingVisibility uom="m">3000</iwxxm:prevailingVisibility>
      <iwxxm:weather xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/306/4678/BR"/>
      <iwxxm:cloud><iwxxm:AerodromeCloudForecast><iwxxm:layer><iwxxm:CloudLayer><iwxxm:amount xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/SCT"/><iwxxm:base uom="[ft_i]">400</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer><iwxxm:layer><iwxxm:CloudLayer><iwxxm:amount xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/BKN"/><iwxxm:base uom="[ft_i]">2000</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer></iwxxm:AerodromeCloudForecast></iwxxm:cloud>
    </iwxxm:MeteorologicalAerodromeTrendForecast>
  </iwxxm:trendForecast>
</iwxxm:METAR>`,
  },
  {
    icao: "EKCH",
    name: "COPENHAGEN KASTRUP AIRPORT",
    lat: 55.6179,
    lon: 12.656,
    tac: "SPECI EKCH 282350Z 09018G28KT CAVOK 01/M03 Q1005 R04L/710166 R04R/710169 R12/710177 NOSIG",
    xml: `<?xml version="1.0"?>
<iwxxm:SPECI xmlns:iwxxm="http://icao.int/iwxxm/2023-1" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" reportStatus="NORMAL" automatedStation="false" permissibleUsage="OPERATIONAL">
  <iwxxm:issueTime><gml:TimeInstant gml:id="t1"><gml:timePosition>2023-05-28T23:50:00Z</gml:timePosition></gml:TimeInstant></iwxxm:issueTime>
  <iwxxm:aerodrome><aixm:AirportHeliport xmlns:aixm="http://www.aixm.aero/schema/5.1.1"><aixm:timeSlice><aixm:AirportHeliportTimeSlice><aixm:locationIndicatorICAO>EKCH</aixm:locationIndicatorICAO></aixm:AirportHeliportTimeSlice></aixm:timeSlice></aixm:AirportHeliport></iwxxm:aerodrome>
  <iwxxm:observationTime xlink:href="#t1"/>
  <iwxxm:observation>
    <iwxxm:MeteorologicalAerodromeObservation cloudAndVisibilityOK="true">
      <iwxxm:airTemperature uom="Cel">1</iwxxm:airTemperature>
      <iwxxm:dewpointTemperature uom="Cel">-3</iwxxm:dewpointTemperature>
      <iwxxm:qnh uom="hPa">1005</iwxxm:qnh>
      <iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWind variableWindDirection="false"><iwxxm:meanWindDirection uom="deg">90</iwxxm:meanWindDirection><iwxxm:meanWindSpeed uom="[kn_i]">18</iwxxm:meanWindSpeed><iwxxm:windGustSpeed uom="[kn_i]">28</iwxxm:windGustSpeed></iwxxm:AerodromeSurfaceWind></iwxxm:surfaceWind>
      <iwxxm:runwayState><iwxxm:AerodromeRunwayState allRunways="false"><iwxxm:runway><aixm:RunwayDirection><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>04L</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:depositType xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-086/7"/><iwxxm:contamination xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-087/1"/><iwxxm:depthOfDeposit uom="mm">01</iwxxm:depthOfDeposit><iwxxm:estimatedSurfaceFrictionOrBrakingAction xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-089/66"/></iwxxm:AerodromeRunwayState></iwxxm:runwayState>
      <iwxxm:runwayState><iwxxm:AerodromeRunwayState allRunways="false"><iwxxm:runway><aixm:RunwayDirection><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>04R</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:depositType xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-086/7"/><iwxxm:contamination xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-087/1"/><iwxxm:depthOfDeposit uom="mm">01</iwxxm:depthOfDeposit><iwxxm:estimatedSurfaceFrictionOrBrakingAction xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-089/69"/></iwxxm:AerodromeRunwayState></iwxxm:runwayState>
      <iwxxm:runwayState><iwxxm:AerodromeRunwayState allRunways="false"><iwxxm:runway><aixm:RunwayDirection><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>12</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:depositType xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-086/7"/><iwxxm:contamination xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-087/1"/><iwxxm:depthOfDeposit uom="mm">01</iwxxm:depthOfDeposit><iwxxm:estimatedSurfaceFrictionOrBrakingAction xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-089/77"/></iwxxm:AerodromeRunwayState></iwxxm:runwayState>
    </iwxxm:MeteorologicalAerodromeObservation>
  </iwxxm:observation>
  <iwxxm:trendForecast xsi:nil="true" nilReason="http://codes.wmo.int/common/nil/noSignificantChange"/>
</iwxxm:SPECI>`,
  },
  {
    icao: "EETN",
    name: "TALLINN AIRPORT",
    lat: 59.4133,
    lon: 24.8328,
    tac: "SPECI EETN 290020Z 24006KT 9999 FEW019 M05/M07 Q1015 R08/0///95 NOSIG",
    xml: `<?xml version="1.0"?>
<iwxxm:SPECI xmlns:iwxxm="http://icao.int/iwxxm/2023-1" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" reportStatus="NORMAL" automatedStation="false" permissibleUsage="OPERATIONAL">
  <iwxxm:issueTime><gml:TimeInstant gml:id="t1"><gml:timePosition>2023-05-29T00:20:00Z</gml:timePosition></gml:TimeInstant></iwxxm:issueTime>
  <iwxxm:aerodrome><aixm:AirportHeliport xmlns:aixm="http://www.aixm.aero/schema/5.1.1"><aixm:timeSlice><aixm:AirportHeliportTimeSlice><aixm:locationIndicatorICAO>EETN</aixm:locationIndicatorICAO></aixm:AirportHeliportTimeSlice></aixm:timeSlice></aixm:AirportHeliport></iwxxm:aerodrome>
  <iwxxm:observationTime xlink:href="#t1"/>
  <iwxxm:observation>
    <iwxxm:MeteorologicalAerodromeObservation cloudAndVisibilityOK="false">
      <iwxxm:airTemperature uom="Cel">-5</iwxxm:airTemperature>
      <iwxxm:dewpointTemperature uom="Cel">-7</iwxxm:dewpointTemperature>
      <iwxxm:qnh uom="hPa">1015</iwxxm:qnh>
      <iwxxm:surfaceWind><iwxxm:AerodromeSurfaceWind variableWindDirection="false"><iwxxm:meanWindDirection uom="deg">240</iwxxm:meanWindDirection><iwxxm:meanWindSpeed uom="[kn_i]">6</iwxxm:meanWindSpeed></iwxxm:AerodromeSurfaceWind></iwxxm:surfaceWind>
      <iwxxm:visibility><iwxxm:AerodromeHorizontalVisibility><iwxxm:prevailingVisibility uom="m">10000</iwxxm:prevailingVisibility><iwxxm:prevailingVisibilityOperator>ABOVE</iwxxm:prevailingVisibilityOperator></iwxxm:AerodromeHorizontalVisibility></iwxxm:visibility>
      <iwxxm:cloud><iwxxm:AerodromeCloud><iwxxm:layer><iwxxm:CloudLayer><iwxxm:amount xlink:href="http://codes.wmo.int/49-2/CloudAmountReportedAtAerodrome/FEW"/><iwxxm:base uom="[ft_i]">1900</iwxxm:base></iwxxm:CloudLayer></iwxxm:layer></iwxxm:AerodromeCloud></iwxxm:cloud>
      <iwxxm:runwayState><iwxxm:AerodromeRunwayState allRunways="false"><iwxxm:runway><aixm:RunwayDirection><aixm:timeSlice><aixm:RunwayDirectionTimeSlice><aixm:designator>08</aixm:designator></aixm:RunwayDirectionTimeSlice></aixm:timeSlice></aixm:RunwayDirection></iwxxm:runway><iwxxm:depositType xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-086/0"/><iwxxm:depthOfDeposit uom="N/A" xsi:nil="true" nilReason="http://codes.wmo.int/common/nil/nothingOfOperationalSignificance"/><iwxxm:estimatedSurfaceFrictionOrBrakingAction xlink:href="http://codes.wmo.int/bufr4/codeflag/0-20-089/95"/></iwxxm:AerodromeRunwayState></iwxxm:runwayState>
    </iwxxm:MeteorologicalAerodromeObservation>
  </iwxxm:observation>
  <iwxxm:trendForecast xsi:nil="true" nilReason="http://codes.wmo.int/common/nil/noSignificantChange"/>
</iwxxm:SPECI>`,
  },
];
