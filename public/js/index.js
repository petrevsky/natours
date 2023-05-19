/* eslint-disable */
import '@babel/polyfill';
import { login, logout } from './login';
import { displayMap } from './mapbox';
import { updateSettings } from './updateSettings';
import { bookTour } from './stripe';

const map = document.getElementById('map');
const loginForm = document.querySelector('.form--login');
const logOutBtn = document.querySelector('.nav__el--logout');
const bookBtn = document.getElementById('book-tour');

const userDataForm = document.querySelector('.form-user-data');
const userPasswordForm = document.querySelector('.form-user-password');

if (map) {
    const locations = JSON.parse(map.dataset.locations);
    displayMap(locations);
}

if (loginForm) {
    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        login(email, password);
    });
}

if (logOutBtn) {
    logOutBtn.addEventListener('click', e => {
        e.preventDefault();
        logout();
    });
}

if (userDataForm) {
    userDataForm.addEventListener('submit', e => {
        e.preventDefault();

        const form = new FormData();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const photo = document.getElementById('photo').files[0];

        form.append('name', name);
        form.append('email', email);
        form.append('photo', photo);

        // console.log(form);

        updateSettings(form, 'data');
    });
}

if (userPasswordForm) {
    userPasswordForm.addEventListener('submit', async e => {
        e.preventDefault();

        document.querySelector('.btn--save-password').textContent =
            'Updating...';

        const currentPassword =
            document.getElementById('password-current').value;
        const newPassword = document.getElementById('password').value;
        const newPasswordConfirm =
            document.getElementById('password-confirm').value;

        await updateSettings(
            {
                currentPassword: currentPassword,
                newPassword: newPassword,
                newPasswordConfirm: newPasswordConfirm,
            },
            'password'
        );

        document.querySelector('.btn--save-password').textContent =
            'Save password';

        document.getElementById('password-current').value = '';
        document.getElementById('password').value = '';
        document.getElementById('password-confirm').value = '';
    });
}

if (bookBtn) {
    bookBtn.addEventListener('click', async e => {
        e.target.textContent = 'Processing...';
        const { tourId } = e.target.dataset;
        await bookTour(tourId);
    });
}
