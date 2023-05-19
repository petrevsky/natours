import axios from 'axios';
import { showAlert } from './alerts';

export const updateSettings = async (data, type) => {
    const route =
        type === 'password'
            ? '/api/v1/users/updateMyPassword'
            : '/api/v1/users/updateMe';

    try {
        const res = await axios({
            method: 'PATCH',
            url: `http://127.0.0.1:3000${route}`,
            data,
        });

        if (res.data.status === 'success') {
            showAlert(
                'success',
                `Your ${type.toUpperCase()} is updated successfuly`
            );
        } else {
            showAlert('error', res.data.message);
        }
    } catch (err) {
        showAlert('error', err.response.data.message);
    }
};
