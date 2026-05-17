from ultralytics import YOLO
from pathlib import Path
from multiprocessing import freeze_support
import shutil


def prepare_small_dataset(train_count=500, val_count=500):
    """
    Uses images from:
        raw_dataset/images/train
        raw_dataset/images/val

    Uses labels from:
        raw_dataset/labels/train
        raw_dataset/labels/val
    """

    # ======================================================
    # SOURCE FOLDERS
    # ======================================================

    src_image_folders = [
        Path("raw_dataset/images/train"),
        Path("raw_dataset/images/val")
    ]

    src_label_folders = [
        Path("raw_dataset/labels/train"),
        Path("raw_dataset/labels/val")
    ]

    # ======================================================
    # DESTINATION FOLDERS
    # ======================================================

    train_img_dir = Path("dataset/images/train")
    train_lbl_dir = Path("dataset/labels/train")

    val_img_dir = Path("dataset/images/val")
    val_lbl_dir = Path("dataset/labels/val")

    # ======================================================
    # CREATE DESTINATION DIRECTORIES
    # ======================================================

    for folder in [
        train_img_dir,
        train_lbl_dir,
        val_img_dir,
        val_lbl_dir
    ]:
        folder.mkdir(parents=True, exist_ok=True)

        # Clear old files
        for file in folder.glob("*"):
            file.unlink()

    # ======================================================
    # GATHER ALL IMAGES
    # ======================================================

    image_files = []

    for image_folder in src_image_folders:

        if not image_folder.exists():
            print(f"[WARNING] Folder not found: {image_folder}")
            continue

        for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp"):
            image_files.extend(image_folder.glob(ext))

    image_files = sorted(image_files)

    total_needed = train_count + val_count

    print(f"[INFO] Total images found: {len(image_files)}")

    if len(image_files) < total_needed:
        raise ValueError(
            f"Need {total_needed} images, "
            f"but only found {len(image_files)}."
        )

    selected_images = image_files[:total_needed]

    print(f"[INFO] Using {train_count} images for training")
    print(f"[INFO] Using {val_count} images for validation")

    # ======================================================
    # COPY IMAGES + LABELS
    # ======================================================

    for i, img_path in enumerate(selected_images):

        # ----------------------------------------------
        # Find matching label file
        # ----------------------------------------------

        label_path = None

        for label_folder in src_label_folders:

            candidate = label_folder / f"{img_path.stem}.txt"

            if candidate.exists():
                label_path = candidate
                break

        # Skip if label not found
        if label_path is None:
            continue

        # ----------------------------------------------
        # Determine destination
        # ----------------------------------------------

        if i < train_count:

            dst_img = train_img_dir / img_path.name
            dst_lbl = train_lbl_dir / label_path.name

        else:

            dst_img = val_img_dir / img_path.name
            dst_lbl = val_lbl_dir / label_path.name

        # ----------------------------------------------
        # Copy image
        # ----------------------------------------------

        shutil.copy2(img_path, dst_img)

    print("[INFO] Small dataset prepared successfully.")


def create_dataset_yaml():

    dataset_yaml = """
path: dataset

train: images/train
val: images/val

names:
  0: car
"""

    Path("dataset.yaml").write_text(dataset_yaml)

    print("[INFO] dataset.yaml created.")


def train_model():

    print("[INFO] Loading YOLO model...")

    model = YOLO("yolov8n.pt")

    print("[INFO] Starting training...")

    model.train(
        data="dataset.yaml",
        epochs=20,
        imgsz=640,
        batch=8,
        name="car_only_parking_model",
        device=0,     
        workers=0         
    )

    print("[INFO] Training completed.")


if __name__ == "__main__":

    freeze_support()

    prepare_small_dataset(
        train_count=500,
        val_count=500
    )

    create_dataset_yaml()

    train_model()