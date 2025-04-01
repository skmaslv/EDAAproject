import tkinter as tk

class FlyZoneDrawer:
    def __init__(self, master):
        self.master = master
        self.canvas = tk.Canvas(master, width=500, height=500)
        self.canvas.pack()

        self.start_x = None
        self.start_y = None
        self.rect = None

        self.instructions = tk.Label(master, text="Click and drag to draw the fly-zone boundary.")
        self.instructions.pack()

        self.canvas.bind("<Button-1>", self.on_click)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_release)

        self.fly_zone = None

    def on_click(self, event):
        # Store the starting position when the user clicks
        self.start_x = event.x
        self.start_y = event.y

        # If there is an existing rectangle, delete it
        if self.rect:
            self.canvas.delete(self.rect)

    def on_drag(self, event):
        # Draw a rectangle as the user drags the mouse
        if self.start_x and self.start_y:
            if self.rect:
                self.canvas.delete(self.rect)

            self.rect = self.canvas.create_rectangle(
                self.start_x, self.start_y, event.x, event.y, outline="black", width=2
            )

    def on_release(self, event):
        # Finalize the rectangle and store the fly-zone
        self.fly_zone = (self.start_x, self.start_y, event.x, event.y)
        print(f"Fly zone set to: {self.fly_zone}")
        self.instructions.config(text="Fly-zone drawn! Now you can use it.")

    def get_fly_zone(self):
        # Return the drawn fly-zone coordinates
        return self.fly_zone

# Set up the Tkinter window
root = tk.Tk()
root.title("Draw Fly-Zone")

fly_zone_drawer = FlyZoneDrawer(root)

# Run the Tkinter event loop
root.mainloop()
