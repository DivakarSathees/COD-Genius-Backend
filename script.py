import sys

class Node:
    def __init__(self, employee_id, name, department):
        self.employee_id = employee_id
        self.name = name
        self.department = department
        self.next = None

class EmployeeManagementSystem:
    def __init__(self):
        self.head = None

    def add_employee(self, employee_id, name, department):
        new_node = Node(employee_id, name, department)
        if not self.head:
            self.head = new_node
            return
        current = self.head
        while current.next:
            current = current.next
        current.next = new_node

    def print_employees(self):
        current = self.head
        while current:
            print(f"{current.employee_id}, {current.name}, {current.department}")
            current = current.next

def main():
    try:
        num_employees = int(sys.stdin.readline().strip())
        ems = EmployeeManagementSystem()
        for _ in range(num_employees):
            employee_id, name, department = sys.stdin.readline().strip().split(',')
            ems.add_employee(employee_id, name, department)
        ems.print_employees()
    except Exception as e:
        pass

if __name__ == '__main__':
    main()