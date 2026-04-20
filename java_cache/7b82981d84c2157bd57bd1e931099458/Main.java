import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Map<String, Course> courses = new HashMap<>();
        Scanner scanner = new Scanner(System.in);

        int n = scanner.nextInt();
        scanner.nextLine();

        for (int i = 0; i < n; i++) {
            String[] courseInfo = scanner.nextLine().split(" ");
            String courseId = courseInfo[0];
            String name = courseInfo[1];
            int credits = Integer.parseInt(courseInfo[2]);
            Course course = new Course(courseId, name, credits);
            courses.put(courseId, course);
            System.out.println("Course added: " + course);
        }

        while (true) {
            System.out.print("Enter command (add/read/update/delete/exit): ");
            String command = scanner.nextLine();

            switch (command) {
                case "exit":
                    System.exit(0);
                    break;
                case "add":
                    addCourse(scanner, courses);
                    break;
                case "read":
                    readCourse(scanner, courses);
                    break;
                case "update":
                    updateCourse(scanner, courses);
                    break;
                case "delete":
                    deleteCourse(scanner, courses);
                    break;
                default:
                    System.out.println("Invalid command.");
            }
        }
    }

    private static void addCourse(Scanner scanner, Map<String, Course> courses) {
        String courseId = scanner.nextLine();
        String name = scanner.nextLine();
        int credits = scanner.nextInt();
        scanner.nextLine();

        if (courses.containsKey(courseId)) {
            System.out.println("Course already exists.");
        } else {
            Course course = new Course(courseId, name, credits);
            courses.put(courseId, course);
            System.out.println("Course added: " + course);
        }
    }

    private static void readCourse(Scanner scanner, Map<String, Course> courses) {
        String courseId = scanner.nextLine();

        if (courses.containsKey(courseId)) {
            Course course = courses.get(courseId);
            System.out.println("Course found: " + course);
        } else {
            System.out.println("Course not found.");
        }
    }

    private static void updateCourse(Scanner scanner, Map<String, Course> courses) {
        String courseId = scanner.nextLine();

        if (courses.containsKey(courseId)) {
            String name = scanner.nextLine();
            int credits = scanner.nextInt();
            scanner.nextLine();
            Course course = courses.get(courseId);
            course.setName(name);
            course.setCredits(credits);
            System.out.println("Course updated: " + course);
        } else {
            System.out.println("Course not found.");
        }
    }

    private static void deleteCourse(Scanner scanner, Map<String, Course> courses) {
        String courseId = scanner.nextLine();

        if (courses.containsKey(courseId)) {
            courses.remove(courseId);
            System.out.println("Course deleted.");
        } else {
            System.out.println("Course not found.");
        }
    }
}

class Course {
    private String courseId;
    private String name;
    private int credits;

    public Course(String courseId, String name, int credits) {
        this.courseId = courseId;
        this.name = name;
        this.credits = credits;
    }

    public String getCourseId() {
        return courseId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getCredits() {
        return credits;
    }

    public void setCredits(int credits) {
        this.credits = credits;
    }

    @Override
    public String toString() {
        return courseId + " " + name + " " + credits;
    }
}