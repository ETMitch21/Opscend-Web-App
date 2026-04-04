import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CustomersStore } from '../../../core/customers/customers.store';
import { Customer } from '../../../core/customers/customer.model';
import { ToastService } from '../../../core/toast/toast-service';

@Component({
  selector: 'app-new-customer',
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './new-customer.html',
  styleUrl: './new-customer.scss',
})
export class NewCustomer {

  private router = inject(Router);
  private toast = inject(ToastService);
  private readonly store = inject(CustomersStore);

  public working:boolean = false;

  public newCustomerForm:FormGroup = new FormGroup({
    'name' : new FormControl('', [Validators.minLength(2), Validators.required]),
    'email' : new FormControl('', [Validators.required, Validators.email]),
    'phone' : new FormControl('', [Validators.required, Validators.minLength(10), Validators.maxLength(10)]),
    'notes' : new FormControl('', [Validators.maxLength(500)])
  });

  create() {
    if(this.newCustomerForm.valid) {
      this.working = true;
      this.store.create({
        'name' : this.newCustomerForm.controls['name'].value,
        'email' : this.newCustomerForm.controls['email'].value,
        'phone' : this.newCustomerForm.controls['phone'].value,
        'notes' : this.newCustomerForm.controls['notes'].value
      }).then((customer:Customer|null) =>{
        if(customer) {
          this.toast.success('Customer Created', `${this.newCustomerForm.controls['name'].value} was created as a new customer.`);
          this.router.navigate(['/customers', 'overview']);
        }
      }).catch((e) => {
        this.toast.error(e);
      }).finally(() => {
        this.working = false;
      });
    }
  }

  cancel() {
    this.router.navigate(['customers', 'overview']);
  }

}
