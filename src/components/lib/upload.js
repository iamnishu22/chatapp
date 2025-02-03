import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

const upload = async (file, setWallpaper) => {
    const date = new Date();
    const storageRef = ref(storage, `image/${date.getTime()}_${file.name}`); // Use backticks for template literals

    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
            },
            (error) => {
                reject("Something went wrong: " + error.code);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                if (setWallpaper) {
                    setWallpaper(downloadURL); // Update wallpaper state here
                }
                resolve(downloadURL);
            }
        );
    });
};

export default upload;
