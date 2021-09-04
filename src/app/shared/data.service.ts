import { Injectable, Type } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Vessel {
  COURSE: number;
  HEADING: number;
  LAT: number;
  LON: number;
  MMSI: number;
  SHIP_ID: number;
  SPEED: number;
  STATUS: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  // tslint:disable-next-line:max-line-length
  apiUrl = 'https://services.marinetraffic.com/api/exportvesseltrack/v:2/cf8f05df0b57bfae43e762cc61fd381239c4c042/period:daily/days:150/mmsi:241486000';
  constructor(private http: HttpClient) {}

  getData(): Observable<Vessel[]> {
    return this.http.get<Vessel[]>(this.apiUrl, { params: this.getParams() });
  }

  private getParams(): HttpParams {
    const options = new HttpParams()
      .set('protocol', 'jsono')
    return options;
  }
}
