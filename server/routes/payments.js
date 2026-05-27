import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { initiatePayment, confirmPayment } from '../controllers/paymentController.js';
import { listMyInvoices, getMyInvoice, downloadMyInvoice } from '../controllers/invoiceController.js';

const r = Router();
r.use(requireAuth);
r.post('/initiate',                    initiatePayment);
r.post('/confirm',                     confirmPayment);
r.get('/invoices',                     listMyInvoices);
r.get('/invoices/:id',                 getMyInvoice);
r.get('/invoices/:id/download',        downloadMyInvoice);

export default r;
