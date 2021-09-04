import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FooterComponent } from './footer/footer.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [FooterComponent],
  imports: [CommonModule, HttpClientModule],
  exports: [FooterComponent]
})
export class SharedModule { }
