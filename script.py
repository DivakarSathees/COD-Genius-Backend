import sys

def calculate_average_attendance(attendees):
    return round(sum(attendees) / len(attendees), 1)

def main():
    try:
        n = int(input().strip())
        if n < 1 or n > 24:
            print("Invalid input")
            return

        attendees = list(map(int, input().strip().split()))

        if len(attendees) != n or any(a < 0 or a > 1000 for a in attendees):
            print("Invalid input")
            return

        average = calculate_average_attendance(attendees)
        print(f"Average attendance: {average}")

    except Exception:
        print("Invalid input")

if __name__ == "__main__":
    main()