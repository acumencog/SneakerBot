const express = require('express');
const { validate } = require('express-validation');
const {
  createAddress,
  getAddress,
  getAddresses,
  updateAddress,
  deleteAddress
} = require('./controller');
const {
  create,
  findOne,
  findAll,
  update,
  deleted
} = require('./validation');

const router = express.Router();

router
  .route('/')
  .post(validate(create), createAddress)
  .get(validate(findAll), getAddresses);

router
  .route('/:id')
  .get(validate(findOne), getAddress)
  .patch(validate(update), updateAddress)
  .delete(validate(deleted), deleteAddress);

module.exports = router;
