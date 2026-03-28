import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { from, Observable, switchMap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  private headers(): Observable<HttpHeaders> {
    return from(this.auth.getToken()).pipe(
      switchMap(token => {
        const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
        return [headers];
      })
    );
  }

  get<T>(path: string): Observable<T> {
    return this.headers().pipe(
      switchMap(headers => this.http.get<T>(`${this.base}${path}`, { headers }))
    );
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.headers().pipe(
      switchMap(headers => this.http.post<T>(`${this.base}${path}`, body, { headers }))
    );
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.headers().pipe(
      switchMap(headers => this.http.patch<T>(`${this.base}${path}`, body, { headers }))
    );
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.headers().pipe(
      switchMap(headers => this.http.put<T>(`${this.base}${path}`, body, { headers }))
    );
  }

  delete<T>(path: string): Observable<T> {
    return this.headers().pipe(
      switchMap(headers => this.http.delete<T>(`${this.base}${path}`, { headers }))
    );
  }

  postFormData<T>(path: string, formData: FormData): Observable<T> {
    return this.headers().pipe(
      switchMap(headers => this.http.post<T>(`${this.base}${path}`, formData, { headers }))
    );
  }

  postBlob(path: string, body: unknown): Observable<Blob> {
    return this.headers().pipe(
      switchMap(headers => this.http.post(`${this.base}${path}`, body, { headers, responseType: 'blob' }))
    );
  }
}
