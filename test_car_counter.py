import cv2
import pandas as pd
from pathlib import Path
from datetime import datetime
from ultralytics import YOLO

# ==========================================================
# CONFIGURATION
# ==========================================================

MODEL_PATH = "runs/detect/car_only_parking_model10/weights/best.pt"
IMAGE_FOLDER = "dataset/images/val"

# "entrance" = cars passing line are counted as entering
# "exit"     = cars passing line are counted as leaving
CAMERA_TYPE = "entrance"

TOTAL_PARKING_SPACES = 100
CONF_THRESHOLD = 0.35
FRAME_DELAY = 50

# Line to count cars
COUNT_LINE_Y = 350
LINE_OFFSET = 40

# ==========================================================
# LOAD MODEL
# ==========================================================

model = YOLO(MODEL_PATH)

# ==========================================================
# LOAD IMAGE FRAMES
# ==========================================================

image_paths = []
for ext in ("*.jpg", "*.jpeg", "*.png", "*.bmp"):
    image_paths.extend(Path(IMAGE_FOLDER).glob(ext))

image_paths = sorted(image_paths)

if len(image_paths) == 0:
    print(f"[ERROR] No images found in {IMAGE_FOLDER}")
    exit()

print(f"[INFO] Found {len(image_paths)} image frames.")

# ==========================================================
# VARIABLES
# ==========================================================

counted_ids = set()
logs = []

entering_count = 0
leaving_count = 0

# ==========================================================
# PROCESS IMAGES AS CONTINUOUS FRAMES
# ==========================================================

for frame_number, image_path in enumerate(image_paths, start=1):

    frame = cv2.imread(str(image_path))

    if frame is None:
        continue

    results = model.track(
        frame,
        persist=True,
        tracker="bytetrack.yaml",
        conf=CONF_THRESHOLD,
        verbose=False
    )

    if results[0].boxes.id is not None:

        boxes = results[0].boxes.xyxy.cpu().numpy()
        track_ids = results[0].boxes.id.cpu().numpy().astype(int)
        confidences = results[0].boxes.conf.cpu().numpy()
        classes = results[0].boxes.cls.cpu().numpy().astype(int)

        for box, track_id, conf, cls in zip(boxes, track_ids, confidences, classes):

            # Your model only has class 0 = car
            if cls != 0:
                continue

            x1, y1, x2, y2 = map(int, box)

            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)

            near_count_line = abs(cy - COUNT_LINE_Y) <= LINE_OFFSET

            # Count each tracked car ID only once
            if track_id not in counted_ids and near_count_line:

                counted_ids.add(track_id)

                if CAMERA_TYPE.lower() == "entrance":
                    direction = "Entering"
                    entering_count += 1
                else:
                    direction = "Leaving"
                    leaving_count += 1

                logs.append({
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "frame": frame_number,
                    "image": image_path.name,
                    "car_id": int(track_id),
                    "camera_type": CAMERA_TYPE,
                    "direction": direction
                })

                print(f"[INFO] Car ID {track_id} counted as {direction}")

            # Draw box
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            label = f"Car ID {track_id} {conf:.2f}"
            cv2.putText(
                frame,
                label,
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 255),
                2
            )

            cv2.circle(frame, (cx, cy), 5, (0, 0, 255), -1)

    cars_inside = entering_count - leaving_count
    available_spaces = TOTAL_PARKING_SPACES - cars_inside
    available_spaces = max(0, min(TOTAL_PARKING_SPACES, available_spaces))

    cv2.line(
        frame,
        (0, COUNT_LINE_Y),
        (frame.shape[1], COUNT_LINE_Y),
        (255, 0, 0),
        2
    )

    cv2.putText(frame, f"Camera: {CAMERA_TYPE.upper()}", (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

    cv2.putText(frame, f"Entering: {entering_count}", (20, 80),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

    cv2.putText(frame, f"Leaving: {leaving_count}", (20, 120),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)

    cv2.putText(frame, f"Available Spaces: {available_spaces}", (20, 160),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 0), 2)

    cv2.imshow("Parking Counter Tracking Demo", frame)

    key = cv2.waitKey(FRAME_DELAY) & 0xFF
    if key == 27:
        break

cv2.destroyAllWindows()

df = pd.DataFrame(logs)
df.to_csv("parking_logs.csv", index=False)

print("\n================ FINAL RESULT ================")
print(f"Camera Type      : {CAMERA_TYPE}")
print(f"Entering Cars    : {entering_count}")
print(f"Leaving Cars     : {leaving_count}")
print(f"Cars Inside      : {entering_count - leaving_count}")
print(f"Available Spaces : {available_spaces}")
print("Logs saved to parking_logs.csv")